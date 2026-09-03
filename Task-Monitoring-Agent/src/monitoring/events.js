// Raw monitoring event envelope.
//
// Every event the agent emits is wrapped here before it is queued and later
// POSTed to /api/monitoring/agent/events. The backend derives PC sessions,
// active/idle/screen-off intervals, app/website sessions and daily summaries
// entirely from these rows — the agent no longer computes any of that.
//
// Envelope fields:
//   client_event_id  UUID v4 — the ONLY idempotency key (server dedups on
//                    (agent_id, client_event_id)).
//   client_seq       monotonically increasing per-agent counter (see SeqStore).
//                    Ordering hint only; it MAY restart at 0 after a reinstall,
//                    which is why the server does not treat it as unique.
//   run_id           new UUID per agent process start. monotonic_ms is only
//                    comparable within the same run_id.
//   monotonic_ms     performance.now() — tamper-resistant clock for duration
//                    math during derivation (QueryPerformanceCounter keeps
//                    counting across sleep on Windows).
//   os_boot_time     epoch ms of the last OS boot. Lets the server tell a real
//                    reboot (screen_off/reboot) from a mere agent restart within
//                    the same boot (untracked).
//   occurred_at      agent wall clock (ISO 8601). Displayed, not trusted for
//                    durations; the server clamps it toward its own receipt time
//                    when it looks tampered.
//
// This module holds no state beyond the per-process run_id and is safe to
// require from anywhere in the agent.

const os = require("os");
const crypto = require("crypto");
const { performance } = require("perf_hooks");

// One id for the lifetime of this process.
const RUN_ID = crypto.randomUUID();

// Wall clock at process start — only used to sanity-check os_boot_time.
const PROCESS_START_WALL_MS = Date.now();

const VALID_TYPES = new Set([
    "agent_start",
    "heartbeat",
    "agent_stop",
    "session_end",
    "input_state",
    "screen_state",
    "app_focus",
    "browser_state",
]);

function getMonotonicMs() {
    return performance.now();
}

// Epoch ms of the last OS boot, computed ONCE at agent start and reused for
// every event of this run. os.uptime() has ~1s granularity and scheduling
// jitter, so recomputing per event would make os_boot_time wobble by a second
// or two — enough to look like a reboot to a naive comparison. Fixing it per
// run means it is constant within a run and only changes across runs when the
// machine actually rebooted (the derivation still applies a generous tolerance
// to the cross-run comparison). See docs: reboot vs agent-restart stitching.
const OS_BOOT_TIME_MS = Math.round(Date.now() - os.uptime() * 1000);

function getOsBootTime() {
    return OS_BOOT_TIME_MS;
}

function nowIso() {
    return new Date().toISOString();
}

/**
 * Build a complete event envelope.
 *
 * @param {object}   params
 * @param {string}   params.type       one of VALID_TYPES
 * @param {object}   [params.payload]  type-specific body (see docs)
 * @param {number}   [params.seq]      value from SeqStore.next(); null if none
 * @param {string|Date} [params.occurredAt]  override the emit timestamp
 * @returns {object} the envelope, ready to hand to EventQueue.append()
 */
function makeEnvelope({ type, payload = null, seq = null, occurredAt = null } = {}) {
    if (!type || typeof type !== "string") {
        throw new Error("makeEnvelope: `type` is required");
    }
    if (!VALID_TYPES.has(type)) {
        throw new Error(`makeEnvelope: unknown event type "${type}"`);
    }

    let occurredIso;
    if (occurredAt instanceof Date) {
        occurredIso = occurredAt.toISOString();
    } else if (typeof occurredAt === "string" && occurredAt) {
        occurredIso = occurredAt;
    } else {
        occurredIso = nowIso();
    }

    return {
        client_event_id: crypto.randomUUID(),
        client_seq: Number.isFinite(seq) ? Math.floor(seq) : null,
        type,
        payload: payload === undefined ? null : payload,
        occurred_at: occurredIso,
        monotonic_ms: getMonotonicMs(),
        run_id: RUN_ID,
        os_boot_time: getOsBootTime(),
    };
}

module.exports = {
    RUN_ID,
    PROCESS_START_WALL_MS,
    VALID_TYPES,
    getMonotonicMs,
    getOsBootTime,
    makeEnvelope,
};
