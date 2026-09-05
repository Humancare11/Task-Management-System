// Screenshot — orchestration (Electron main process).
//
// A SEPARATE feature from Live Screen: no WebRTC, no peer connection, no
// persistent session or banner. The agent polls a lightweight endpoint and,
// when a capture is pending, takes exactly ONE still frame with Electron's
// desktopCapturer (main process only — no renderer, no getDisplayMedia, no
// video stream at all) and uploads it once. Because it has zero WebRTC
// dependency, this keeps working even when Live Screen's peer-to-peer
// connection cannot be established.
//
// Driven by the SAME heartbeat `live_screen` signal as Live Screen (same org
// gate, same legal gate, same one-time consent) — from the employee's point
// of view "someone may see my screen" is one permission, whether live or a
// single frame. There is no per-session cadence to speed up for: one poll
// speed is enough, since a capture is immediate once noticed.
//
// The employee is told about this capability up front, once, in the setup
// consent (see config/liveScreenConsentDocument.js on the backend, v5) —
// there is deliberately no on-screen popup at the moment of each capture. An
// earlier version showed one, but an always-on-top window landing on the
// employee's screen every time a screenshot was taken interrupted their work
// for something instantaneous they had no way to pause or stop anyway. Each
// capture is still fully accounted for via the server-side audit record
// (monitoring_screenshot_requests) regardless.

const { screen, desktopCapturer } = require("electron");
const logger = require("../../utils/logger");
const screenshotClient = require("./screenshotClient");

let config = null;
let pollTimer = null;
let polling = false;
let orgEnabled = false; // org has live_screen_enabled (from the heartbeat)
let capturingRequestId = null; // guards against double-capturing the same request

function periodMs() {
    return (config.screenshotPollIntervalSeconds || 5) * 1000;
}

// --------------------------------------------------------------- capture

async function captureAndUpload(requestId) {
    capturingRequestId = requestId;
    try {
        const primary = screen.getPrimaryDisplay();
        const scale = primary.scaleFactor || 1;
        const width = Math.max(1, Math.round(primary.size.width * scale));
        const height = Math.max(1, Math.round(primary.size.height * scale));

        const sources = await desktopCapturer.getSources({
            types: ["screen"],
            thumbnailSize: { width, height },
        });
        const primaryId = String(primary.id);
        const picked = sources.find((s) => s.display_id === primaryId) || sources[0];
        if (!picked || picked.thumbnail.isEmpty()) {
            throw new Error("no display source available");
        }

        const buffer = picked.thumbnail.toPNG();
        const imageBase64 = buffer.toString("base64");
        const r = await screenshotClient.upload(config, { requestId, imageBase64 });
        if (r.kind !== "ok") {
            logger.warn(`Screenshot: upload failed (${r.kind}${r.status ? " " + r.status : ""}).`);
        } else {
            logger.info(`Screenshot: delivered request ${requestId}.`);
        }
    } catch (err) {
        logger.warn(`Screenshot: capture failed: ${err.message}`);
        await screenshotClient
            .upload(config, { requestId, error: String(err.message || "capture_failed").slice(0, 40) })
            .catch(() => {});
    } finally {
        capturingRequestId = null;
    }
}

// --------------------------------------------------------------- poll loop

async function tick() {
    if (polling || !config || capturingRequestId) return;
    polling = true;
    try {
        const res = await screenshotClient.poll(config);
        if (res.kind === "disabled" || res.kind === "auth") {
            orgEnabled = false;
            stopLoop();
            return;
        }
        if (res.kind !== "ok") return; // transient network/HTTP hiccup — keep the loop

        const d = res.directive || { action: "none" };
        if (d.action === "capture" && d.request_id) {
            // Fire-and-forget: don't block the poll loop's own timer on the
            // capture+upload; the capturingRequestId guard above prevents a
            // second tick from starting a concurrent capture in the meantime.
            captureAndUpload(d.request_id).catch(() => {});
        }
    } catch (err) {
        logger.warn(`Screenshot poll error: ${err.message}`);
    } finally {
        polling = false;
    }
}

function ensurePolling() {
    if (!config || pollTimer) return;
    const ms = periodMs();
    pollTimer = setInterval(() => {
        tick().catch((e) => logger.warn(`Screenshot tick: ${e.message}`));
    }, ms);
    if (pollTimer.unref) pollTimer.unref();
    tick().catch(() => {});
    logger.info(`Screenshot: polling every ${ms / 1000}s.`);
}

function stopLoop() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
}

// --------------------------------------------------------------- public

/**
 * Called on every good heartbeat with the SAME `live_screen` block Live
 * Screen uses — Screenshot shares its org gate, legal gate, and one-time
 * consent. `consent_required` true means the org has the feature enabled,
 * which is what drives this poll loop (independent of whether a Live Screen
 * session happens to be running).
 */
function applyScreenshotSignal(cfg, signal) {
    config = cfg;

    if (!signal || typeof signal !== "object") {
        orgEnabled = false;
        stopLoop();
        return;
    }

    orgEnabled = Boolean(signal.consent_required);
    if (orgEnabled) {
        ensurePolling();
    } else {
        stopLoop();
    }
}

function shutdown() {
    stopLoop();
}

module.exports = { applyScreenshotSignal, shutdown };
