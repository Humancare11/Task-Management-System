// Persistent per-agent event sequence counter.
//
// client_seq is only an ordering hint for the backend (it dedups on
// client_event_id, not seq), so a repeated or reset value is tolerated by
// design. We still persist it so ordering stays stable across normal restarts.
//
// Writes are atomic: temp file -> fsync -> rename. A crash mid-write leaves the
// previous value intact; the very worst case is one repeated seq, which the
// server handles.

const fs = require("fs");
const path = require("path");

class SeqStore {
    /**
     * @param {string} filePath  absolute path to the counter file
     */
    constructor(filePath) {
        if (!filePath) throw new Error("SeqStore requires a filePath");
        this.filePath = filePath;
        this.tmpPath = `${filePath}.tmp`;
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        this.value = this._load();
    }

    _load() {
        try {
            const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
            if (parsed && Number.isFinite(parsed.seq) && parsed.seq >= 0) {
                return Math.floor(parsed.seq);
            }
        } catch {
            /* missing or corrupt -> start from 0 */
        }
        return 0;
    }

    _persist() {
        const fd = fs.openSync(this.tmpPath, "w");
        try {
            fs.writeFileSync(fd, JSON.stringify({ seq: this.value }));
            fs.fsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        // rename() replaces an existing file atomically on both POSIX and
        // Windows (libuv uses MOVEFILE_REPLACE_EXISTING).
        fs.renameSync(this.tmpPath, this.filePath);
    }

    /** Increment, persist (best effort), and return the new value. */
    next() {
        this.value += 1;
        try {
            this._persist();
        } catch {
            /* best effort: a repeated seq after a crash is acceptable */
        }
        return this.value;
    }

    current() {
        return this.value;
    }
}

module.exports = { SeqStore };
