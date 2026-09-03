// Event pipeline coordinator (Phase 1).
//
// A process-wide singleton that:
//   - owns the crash-safe EventQueue (persistent JSONL) and the SeqStore,
//   - wraps every emitted event in an envelope (monitoring/events.js),
//   - flushes queued events to POST /api/monitoring/agent/events on an interval
//     with exponential backoff on failure,
//   - only removes events from the local queue once the backend has accepted
//     them (§8a: no gaps).
//
// The legacy /activities path is completely independent of this module and is
// unaffected whether the pipeline is running or not. If EVENTS_PIPELINE_ENABLED
// is false the entry points never call initEventPipeline(), and emitEvent()
// from anywhere else is a safe no-op.

const path = require("path");
const os = require("os");
const logger = require("../utils/logger");
const { EventQueue } = require("../storage/eventQueue");
const { SeqStore } = require("../storage/seqStore");
const { makeEnvelope, RUN_ID, getOsBootTime } = require("./events");
const { postEvents } = require("../api/eventClient");

let pkgVersion = "unknown";
try {
    // eslint-disable-next-line global-require
    pkgVersion = require("../../package.json").version || "unknown";
} catch {
    /* keep default */
}

let queue = null;
let seq = null;
let config = null;
let dataDir = null;

let flushTimer = null;
let flushing = false;
let stopped = true;
let consecutiveFailures = 0;
let warnedUninitialised = false;

function isInitialised() {
    return Boolean(queue);
}

/**
 * @param {object} opts
 * @param {string} opts.dataDir   directory for the queue + seq files
 * @param {object} opts.config    build config (apiBaseUrl / agentUuid / secret / intervals)
 */
function initEventPipeline(opts = {}) {
    if (queue) {
        const credentialsChanged =
            opts.config &&
            config &&
            (opts.config.agentUuid !== config.agentUuid ||
                opts.config.apiBaseUrl !== config.apiBaseUrl);
        if (credentialsChanged) {
            // The queue may hold events belonging to a different agent
            // enrolment — do not ship those under the new credentials.
            logger.info(
                "Event pipeline: credentials changed — discarding queued events and re-initialising.",
            );
            discardEventPipeline();
            // fall through to a fresh init
        } else {
            // Already running for the same agent — just refresh intervals.
            if (opts.config) config = opts.config;
            return;
        }
    }
    if (!opts.dataDir) throw new Error("initEventPipeline requires a dataDir");
    if (!opts.config) throw new Error("initEventPipeline requires a config");

    dataDir = opts.dataDir;
    config = opts.config;
    queue = new EventQueue({
        filePath: path.join(dataDir, "events.jsonl"),
        maxEvents: config.eventQueueMaxEvents || 20000,
    });
    seq = new SeqStore(path.join(dataDir, "event-seq.json"));
    stopped = false;
    consecutiveFailures = 0;
    warnedUninitialised = false;

    logger.info(`Event pipeline initialised (${queue.size()} event(s) already queued).`);

    emitEvent("agent_start", {
        agent_version: pkgVersion,
        os: `${process.platform} ${os.release()}`,
        os_boot_time: getOsBootTime(),
        run_id: RUN_ID,
    });
}

/** Update credentials / intervals without tearing down the queue. */
function updatePipelineConfig(nextConfig) {
    if (nextConfig) config = nextConfig;
}

/**
 * Enqueue one event. Safe to call from anywhere; a no-op (with a one-time
 * warning) if the pipeline has not been initialised.
 */
function emitEvent(type, payload = null, occurredAt = null) {
    if (!queue) {
        if (!warnedUninitialised) {
            // Expected in heartbeat-only mode (npm run heartbeat); a real
            // concern only if the full agent forgot to initialise the pipeline.
            logger.info(
                `Event pipeline not initialised — "${type}" and further events are not being recorded.`,
            );
            warnedUninitialised = true;
        }
        return;
    }
    try {
        const envelope = makeEnvelope({
            type,
            payload,
            seq: seq.next(),
            occurredAt,
        });
        queue.append(envelope);
    } catch (err) {
        logger.warn(`Failed to enqueue "${type}" event: ${err.message}`);
    }
}

async function flushOnce() {
    if (!queue || !config || flushing) return { kind: "idle" };
    flushing = true;
    try {
        const batch = queue.peek(config.eventBatchMaxSize || 100);
        if (batch.length === 0) return { kind: "empty" };

        const res = await postEvents(config, batch);

        if (res.kind === "ok") {
            const removed = queue.commit(res.acceptedIds);
            consecutiveFailures = 0;
            logger.info(
                `Events submitted: ${removed} accepted (${queue.size()} still queued).`,
            );
            return res;
        }

        consecutiveFailures += 1;
        if (res.kind === "auth") {
            logger.warn("Event submission failed: authentication failed. Events retained.");
        } else if (res.kind === "network") {
            logger.warn("Event submission failed: backend unavailable. Events retained.");
        } else if (res.kind === "http") {
            logger.warn(
                `Event submission failed: backend returned HTTP ${res.status}. Events retained.`,
            );
        } else {
            logger.warn("Event submission failed: unexpected error. Events retained.");
        }
        return res;
    } finally {
        flushing = false;
    }
}

function scheduleNextFlush() {
    if (stopped || !config) return;
    const base = (config.eventFlushIntervalSeconds || 20) * 1000;
    // 1x, 2x, 4x, ... capped at 32x after five consecutive failures.
    const multiplier = Math.min(2 ** Math.min(consecutiveFailures, 5), 32);
    const delay = base * multiplier;

    flushTimer = setTimeout(async () => {
        flushTimer = null;
        try {
            await flushOnce();
        } catch (err) {
            logger.warn(`Event flush error: ${err.message}`);
        }
        scheduleNextFlush();
    }, delay);

    if (flushTimer.unref) flushTimer.unref();
}

/** Begin the periodic flush loop (idempotent). */
function startEventFlush() {
    if (!queue || flushTimer) return;
    stopped = false;
    scheduleNextFlush();
}

/**
 * Stop the flush loop and (by default) attempt one last flush so a clean exit
 * ships whatever is buffered. Emits agent_stop first.
 */
async function shutdownEventPipeline({ finalFlush = true, reason = "shutdown" } = {}) {
    if (!queue) return;
    stopped = true;
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    emitEvent("agent_stop", { reason });
    if (finalFlush) {
        try {
            await flushOnce();
        } catch {
            /* best effort */
        }
    }
}

/**
 * Fully tear down and forget the queue (used on reconfigure, when credentials
 * may now belong to a different agent enrolment). Discards unsent events.
 */
function discardEventPipeline() {
    stopped = true;
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    try {
        if (queue) queue.clear();
    } catch (err) {
        logger.warn(`Failed to clear event queue: ${err.message}`);
    }
    queue = null;
    seq = null;
    config = null;
    dataDir = null;
    consecutiveFailures = 0;
    logger.info("Event pipeline discarded (queue cleared).");
}

module.exports = {
    initEventPipeline,
    updatePipelineConfig,
    emitEvent,
    flushOnce,
    startEventFlush,
    shutdownEventPipeline,
    discardEventPipeline,
    isInitialised,
};
