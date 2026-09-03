// §5b captured-content pipeline — SEPARATE from the events pipeline.
//
// Design choices that keep the plaintext exposure minimal:
//   - The queue is IN MEMORY only. Captured text is never written to disk on the
//     employee's machine (unlike the crash-safe events queue). A crash loses at
//     most a few unsent search terms — an acceptable trade for no plaintext at
//     rest.
//   - Nothing is queued or sent unless setActive(true) has been called, which
//     the tracker only does when the heartbeat says
//     content_capture.active === true (legal gate open + org enabled + consent
//     on file). Default is inactive.
//   - A 501/403 from the server (gate closed / org off / consent gone) clears
//     the queue and flips back to inactive immediately.
//
// The text lives transiently in RAM here, travels in the POST body, and is
// dropped as soon as the server accepts it (the server encrypts before storing).

const crypto = require("crypto");
const logger = require("../utils/logger");
// Imported as the module object (not destructured) so tests can stub postContent.
const contentClient = require("../api/contentClient");

const MAX_QUEUE = 500;

let config = null;
let active = false;
let queue = []; // [{ client_event_id, app, kind, text, domain, captured_at }]
let flushTimer = null;
let flushing = false;
let stopped = true;

function initContentPipeline(opts = {}) {
    config = opts.config || config;
    queue = [];
    active = false;
    stopped = false;
}

function updateContentConfig(next) {
    if (next) config = next;
}

/** Enable/disable capture. Disabling drops anything queued (plaintext). */
function setActive(next) {
    const value = Boolean(next);
    if (value === active) return;
    active = value;
    if (!active) {
        if (queue.length) {
            logger.info(`Content capture disabled — dropping ${queue.length} unsent item(s).`);
        }
        queue = [];
    } else {
        logger.info("Content capture active.");
    }
}

function isActive() {
    return active;
}

/**
 * Queue one captured item. No-op unless active. Never throws.
 * @param {{ app:string, kind:"search"|"prompt", text:string, domain?:string }} item
 */
function emitContent(item) {
    if (!active || !item) return;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) return;
    queue.push({
        client_event_id: crypto.randomUUID(),
        app: String(item.app || "Unknown").slice(0, 100),
        kind: item.kind === "prompt" ? "prompt" : "search",
        text,
        domain: item.domain ? String(item.domain).toLowerCase().slice(0, 255) : null,
        captured_at: new Date().toISOString(),
    });
    if (queue.length > MAX_QUEUE) {
        queue.splice(0, queue.length - MAX_QUEUE); // drop oldest
    }
}

async function flushOnce() {
    if (flushing || !config || !active || queue.length === 0) return { kind: "idle" };
    flushing = true;
    try {
        const batch = queue.slice(0, 100);
        const res = await contentClient.postContent(config, batch);

        if (res.kind === "ok") {
            const accepted = new Set(res.acceptedIds || []);
            queue = queue.filter((i) => !accepted.has(i.client_event_id));
            if ((res.dropped || []).length) {
                logger.info(`Content: server dropped ${res.dropped.length} item(s) by policy.`);
            }
            return res;
        }
        if (res.kind === "disabled") {
            logger.info(
                `Content capture rejected by server (HTTP ${res.status}) — stopping and clearing the queue.`,
            );
            queue = [];
            active = false;
            return res;
        }
        if (res.kind === "auth") {
            logger.warn("Content submission: auth failed. Held.");
        } else if (res.kind === "network") {
            logger.warn("Content submission: backend unavailable. Held.");
        } else {
            logger.warn(`Content submission failed (${res.kind}${res.status ? " " + res.status : ""}). Held.`);
        }
        // Bounded hold — never let a long outage grow memory without limit.
        if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
        return res;
    } finally {
        flushing = false;
    }
}

function startContentFlush() {
    if (flushTimer || !config) return;
    stopped = false;
    const period = (config.contentFlushIntervalSeconds || 30) * 1000;
    flushTimer = setInterval(() => {
        flushOnce().catch((err) => logger.warn(`Content flush error: ${err.message}`));
    }, period);
    if (flushTimer.unref) flushTimer.unref();
}

async function shutdownContentPipeline() {
    stopped = true;
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    try {
        await flushOnce();
    } catch {
        /* best effort */
    }
    queue = [];
    active = false;
}

function _queueLength() {
    return queue.length;
}

module.exports = {
    initContentPipeline,
    updateContentConfig,
    setActive,
    isActive,
    emitContent,
    flushOnce,
    startContentFlush,
    shutdownContentPipeline,
    _queueLength,
};
