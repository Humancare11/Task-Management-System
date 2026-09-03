// Keyboard/mouse active-vs-idle state machine (§3).
//
// The user is ACTIVE while there is keyboard or mouse input, and IDLE after
// `idleThresholdSeconds` (default 300 = 5 minutes) with no input. This is a
// separate concept from Screen-OFF (display power / lock / sleep) — the two are
// never mixed. The derivation engine (Phase 2) subtracts screen-off time from
// idle time so nothing is double-counted.
//
// Detection uses the existing system-wide GetLastInputInfo probe (idleTime.js);
// it never uses keyboard/mouse hooks and never sees which keys or where.
//
// This module only EMITS transition events (input_state) into the pipeline.
// It does not touch the legacy /activities path.

const { getIdleSeconds } = require("./idleTime");
const logger = require("../utils/logger");

/**
 * Pure reducer. Given the previous state and the current system idle time,
 * decide the next state and — for a transition — when it began.
 *
 * @param {{state: "active"|"idle"}} prev
 * @param {number} idleSeconds     whole seconds since last system input
 * @param {Date}   now
 * @param {number} thresholdSeconds
 * @returns {{ state: "active"|"idle", changed: boolean, boundary: Date|null }}
 *          `boundary` is when the new state actually began: back-dated to the
 *          last input for an idle transition, `now` for an active transition.
 */
function reduceInputState(prev, idleSeconds, now, thresholdSeconds) {
    if (!Number.isFinite(idleSeconds) || idleSeconds < 0) {
        return { state: prev.state, changed: false, boundary: null };
    }

    const shouldBeIdle = idleSeconds >= thresholdSeconds;

    if (shouldBeIdle && prev.state !== "idle") {
        return {
            state: "idle",
            changed: true,
            boundary: new Date(now.getTime() - idleSeconds * 1000),
        };
    }
    if (!shouldBeIdle && prev.state !== "active") {
        return { state: "active", changed: true, boundary: new Date(now.getTime()) };
    }
    return { state: prev.state, changed: false, boundary: null };
}

/**
 * Start polling and emitting input_state transitions.
 *
 * @param {object}  config   agent config (idleThresholdSeconds, inputPollIntervalSeconds)
 * @param {Function} emit     emit(type, payload, occurredAtIso)
 * @returns {{ stop: Function, getState: Function }}
 */
function startInputStateTracking(config, emit) {
    const threshold = config.idleThresholdSeconds || 300;
    const intervalMs = (config.inputPollIntervalSeconds || 25) * 1000;

    let current = { state: "active" }; // assume active until a probe says otherwise
    let running = false;

    async function tick() {
        if (running) return;
        running = true;
        try {
            const idleSeconds = await getIdleSeconds();
            if (idleSeconds === null) return; // can't tell -> hold current state

            const now = new Date();
            const next = reduceInputState(current, idleSeconds, now, threshold);
            if (!next.changed) return;

            current = { state: next.state };
            const lastInputAt = new Date(now.getTime() - idleSeconds * 1000);
            emit(
                "input_state",
                {
                    state: next.state,
                    last_input_at: lastInputAt.toISOString(),
                },
                // occurred_at is always the detection instant; the derivation
                // engine uses payload.last_input_at for the real boundary.
                now.toISOString(),
            );
            logger.info(
                `Input state: ${next.state}` +
                (next.state === "idle" ? ` (since ${lastInputAt.toISOString()})` : ""),
            );
        } catch {
            /* hold state on error */
        } finally {
            running = false;
        }
    }

    tick();
    const timer = setInterval(tick, intervalMs);
    if (timer.unref) timer.unref();

    return {
        stop() {
            clearInterval(timer);
        },
        getState() {
            return current.state;
        },
    };
}

module.exports = { reduceInputState, startInputStateTracking };
