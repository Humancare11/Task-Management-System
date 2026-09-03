// Crash-safe, append-only local event queue (JSONL).
//
// Replaces the old in-memory activity buffer: events survive process crash,
// power loss and offline periods, and are re-sent when connectivity returns
// (§8a). Each line is one JSON event envelope (see monitoring/events.js).
//
// Durability rules:
//   * append()    -> single fs.appendFileSync of "<json>\n".
//   * A torn final line (power cut mid-append: file does not end in "\n", or the
//     last line will not parse) is discarded — that event was never flushed.
//   * Corruption BEFORE the last line -> the whole file is copied aside as
//     "<file>.corrupt-<ts>" and every still-parseable line is salvaged.
//   * Compaction after a successful send is temp-file + fsync + atomic rename,
//     never an in-place truncate/rewrite.
//   * A hard cap drops the OLDEST events if the file grows without bound during
//     a very long outage (mirrors the previous 500-activity safety valve).
//
// The whole file is re-read on each operation. Event volume is low (a handful
// per minute) and it is flushed on a short interval, so this stays cheap; a
// Phase 1 in-memory mirror can be layered on later if profiling ever asks for
// it.

const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const DEFAULT_MAX_EVENTS = 20000;

class EventQueue {
    /**
     * @param {object} opts
     * @param {string} opts.filePath          absolute path to the .jsonl file
     * @param {number} [opts.maxEvents]        hard cap; oldest dropped beyond it
     */
    constructor({ filePath, maxEvents = DEFAULT_MAX_EVENTS } = {}) {
        if (!filePath) throw new Error("EventQueue requires a filePath");
        this.filePath = filePath;
        this.tmpPath = `${filePath}.tmp`;
        this.maxEvents = Math.max(1, maxEvents);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        this._recover();
    }

    // ---- reading -----------------------------------------------------------

    _readFile() {
        try {
            return fs.readFileSync(this.filePath, "utf8");
        } catch (err) {
            if (err.code === "ENOENT") return null;
            throw err;
        }
    }

    // Parse the file into events, tolerating a torn last line and quarantining
    // earlier corruption. Returns { events, dirty } where `dirty` means the
    // on-disk form should be rewritten to drop junk.
    _parse() {
        const raw = this._readFile();
        if (raw === null || raw.length === 0) return { events: [], dirty: false };

        const endsWithNewline = raw.endsWith("\n");
        const segments = raw.split("\n").filter((s) => s.length > 0);
        if (segments.length === 0) return { events: [], dirty: raw.length > 0 };

        const events = [];
        let dirty = false;

        for (let i = 0; i < segments.length; i += 1) {
            const isLast = i === segments.length - 1;
            let parsed;
            try {
                parsed = JSON.parse(segments[i]);
            } catch {
                if (isLast && !endsWithNewline) {
                    logger.warn(
                        "Event queue: discarding torn final line (incomplete write).",
                    );
                    dirty = true;
                    continue;
                }
                return this._quarantine(segments, i);
            }

            if (parsed && typeof parsed === "object" && parsed.client_event_id) {
                events.push(parsed);
            } else {
                dirty = true; // structurally invalid — drop on next compaction
            }
        }

        return { events, dirty };
    }

    _quarantine(segments, badIndex) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const corruptPath = `${this.filePath}.corrupt-${stamp}`;
        try {
            fs.copyFileSync(this.filePath, corruptPath);
            logger.warn(
                `Event queue: corruption at line ${badIndex + 1}; original preserved as ${path.basename(
                    corruptPath,
                )}.`,
            );
        } catch (err) {
            logger.warn(`Event queue: could not preserve corrupt file: ${err.message}`);
        }

        const events = [];
        for (const seg of segments) {
            try {
                const parsed = JSON.parse(seg);
                if (parsed && parsed.client_event_id) events.push(parsed);
            } catch {
                /* skip unparseable */
            }
        }
        return { events, dirty: true };
    }

    // ---- recovery / compaction -------------------------------------------

    _recover() {
        const { events, dirty } = this._parse();
        let kept = events;
        let mustRewrite = dirty;

        if (events.length > this.maxEvents) {
            const overflow = events.length - this.maxEvents;
            kept = events.slice(overflow);
            mustRewrite = true;
            logger.warn(
                `Event queue: over capacity (${events.length}); dropped ${overflow} oldest event(s).`,
            );
        }

        if (mustRewrite) this._rewrite(kept);
    }

    // Atomic replace: write temp, fsync, rename over the original.
    _rewrite(events) {
        const body = events.map((e) => JSON.stringify(e)).join("\n");
        const data = body ? `${body}\n` : "";
        const fd = fs.openSync(this.tmpPath, "w");
        try {
            fs.writeFileSync(fd, data);
            fs.fsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.renameSync(this.tmpPath, this.filePath);
    }

    // ---- public API ------------------------------------------------------

    /** Append one event envelope. */
    append(event) {
        if (!event || !event.client_event_id) {
            throw new Error("EventQueue.append: event must have a client_event_id");
        }
        fs.appendFileSync(this.filePath, `${JSON.stringify(event)}\n`);
    }

    /** Append many event envelopes in a single write. */
    appendMany(list) {
        if (!Array.isArray(list) || list.length === 0) return;
        for (const e of list) {
            if (!e || !e.client_event_id) {
                throw new Error("EventQueue.appendMany: every event needs a client_event_id");
            }
        }
        const chunk = list.map((e) => `${JSON.stringify(e)}\n`).join("");
        fs.appendFileSync(this.filePath, chunk);
    }

    /** Oldest-first view of up to `limit` queued events (no removal). */
    peek(limit = 100) {
        const { events } = this._parse();
        return limit > 0 ? events.slice(0, limit) : events.slice();
    }

    /** Number of events currently queued. */
    size() {
        return this._parse().events.length;
    }

    /**
     * Remove the given events (matched by client_event_id) and compact the file.
     * Call this only after the backend has acknowledged them.
     * @param {Iterable<string>|Set<string>} committedIds
     * @returns {number} how many events were removed
     */
    commit(committedIds) {
        const ids = committedIds instanceof Set ? committedIds : new Set(committedIds);
        if (ids.size === 0) return 0;
        const { events } = this._parse();
        const remaining = events.filter((e) => !ids.has(e.client_event_id));
        const removed = events.length - remaining.length;
        if (removed > 0) this._rewrite(remaining);
        return removed;
    }

    /** Drop everything. */
    clear() {
        this._rewrite([]);
    }
}

module.exports = { EventQueue, DEFAULT_MAX_EVENTS };
