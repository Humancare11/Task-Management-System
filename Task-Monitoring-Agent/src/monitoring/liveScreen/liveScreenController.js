// Live Screen — orchestration (Electron main process).
//
// Lifecycle, driven by the heartbeat's `live_screen` signal + a poll loop that
// runs at one of two speeds:
//   idle   (config.liveScreenIdlePollIntervalSeconds, default 5s) — runs
//          continuously whenever the org has Live Screen enabled, so a NEW
//          request from a viewer is noticed within one idle interval instead
//          of waiting for the next heartbeat (which can be ~30s away — that
//          wait was the main cause of a slow "Connecting...").
//   active (config.liveScreenPollIntervalSeconds, default 2s) — used once a
//          session is pending/connecting/live, for snappier signaling.
//
//   1. heartbeat says the org has it enabled -> start idle polling
//   2. poll returns action:"start"
//        a. show the on-screen "your screen is being viewed" BANNER. If the
//           banner cannot be shown, ABORT — no covert viewing, ever.
//        b. open a hidden capture window (ui/livescreen.html) which captures
//           the primary screen, builds an RTCPeerConnection, and returns an
//           SDP offer + ICE candidates over IPC.
//        c. relay offer -> server; server -> viewer; viewer answer/ICE -> here
//           -> capture window. Media flows peer-to-peer, never through us.
//   3. stop (viewer/employee/error/timeout/shutdown) -> destroy the capture
//      window (stops the screen track + closes the peer connection) and the
//      banner, and tell the server.
//
// Nothing is recorded. The capture window holds the MediaStream only in memory
// for the life of the session.

const path = require("path");
const { BrowserWindow, ipcMain, screen, desktopCapturer } = require("electron");
const logger = require("../../utils/logger");
const liveScreenClient = require("./liveScreenClient");

let config = null;
let pollTimer = null;
let pollPeriodMs = null; // the interval pollTimer is currently running at
let polling = false;
let orgEnabled = false; // org has live_screen_enabled (from the heartbeat)
// A single ambiguous "action: none" (the server has no record of this
// session at all) does not end an active session by itself — it could be a
// transient blip (brief backend restart, a race right after a viewer
// reconnects). Only NONE_STREAK_LIMIT consecutive polls end it. An explicit
// "action: stop" (the server has a definite ended/error record) is acted on
// immediately — that is a real signal, not an ambiguity.
const NONE_STREAK_LIMIT = 3;
let noneStreak = 0;

let session = null; // { id, captureWin, bannerWin, maxTimer, iceServers, viewerName }

function isSessionActive() {
    return Boolean(session);
}

// --------------------------------------------------------------- banner

function showBanner(viewerName) {
    const primary = screen.getPrimaryDisplay();
    const width = 460;
    const height = 52;
    const win = new BrowserWindow({
        width,
        height,
        x: Math.round(primary.workArea.x + (primary.workArea.width - width) / 2),
        y: primary.workArea.y + 8,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        focusable: false,
        alwaysOnTop: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "..", "..", "preload-livescreen.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.loadFile(path.join(__dirname, "..", "..", "ui", "banner.html"));
    win.once("ready-to-show", () => {
        win.showInactive();
        win.webContents.send("ls:bannerInfo", { viewerName: viewerName || "an authorized viewer" });
    });
    return win;
}

// --------------------------------------------------------------- capture window

function openCaptureWindow(sessionId, iceServers) {
    const win = new BrowserWindow({
        width: 320,
        height: 200,
        show: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, "..", "..", "preload-livescreen.js"),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
            // isolated session so the capture handler below never touches the
            // setup window's session
            partition: "livescreen-capture",
        },
    });

    // getDisplayMedia() in the renderer routes here; we pick the primary screen.
    win.webContents.session.setDisplayMediaRequestHandler(
        async (request, callback) => {
            try {
                const sources = await desktopCapturer.getSources({ types: ["screen"] });
                const primaryId = String(screen.getPrimaryDisplay().id);
                const picked =
                    sources.find((s) => s.display_id === primaryId) || sources[0];
                if (!picked) return callback({});
                callback({ video: picked, audio: false });
            } catch (err) {
                logger.warn(`Live screen: source pick failed: ${err.message}`);
                callback({});
            }
        },
        { useSystemPicker: false },
    );

    win.loadFile(path.join(__dirname, "..", "..", "ui", "livescreen.html"));
    win.webContents.once("did-finish-load", () => {
        win.webContents.send("ls:init", { sessionId, iceServers: iceServers || [] });
    });
    return win;
}

// --------------------------------------------------------------- session

async function startSession(directive) {
    if (session) return; // one at a time
    const id = directive.session_id;
    logger.info(`Live screen: starting session ${id} for ${directive.viewer_name || "a viewer"}.`);

    // 1. Banner FIRST — the employee must see it. No banner -> no session.
    let bannerWin;
    try {
        bannerWin = showBanner(directive.viewer_name);
    } catch (err) {
        logger.error(`Live screen: banner failed (${err.message}) — aborting session.`);
        await liveScreenClient.signal(config, { session_id: id, type: "error" });
        return;
    }

    session = {
        id,
        bannerWin,
        captureWin: null,
        iceServers: directive.ice_servers || [],
        viewerName: directive.viewer_name || null,
        connected: false,
        // No automatic maximum by default (liveScreenMaxSessionSeconds is 0) —
        // the session runs until the viewer, the employee's Stop button, or a
        // real connection failure ends it. An operator can opt into a cap via
        // LIVE_SCREEN_MAX_SESSION_SECONDS.
        maxTimer:
            config.liveScreenMaxSessionSeconds > 0
                ? setTimeout(
                    () => stopSession("max_duration", { notifyServer: true }),
                    config.liveScreenMaxSessionSeconds * 1000,
                )
                : null,
        // Local safety net: if the peer connection never establishes (e.g.
        // STUN-only on a strict NAT with no TURN), tear everything down so the
        // screen capture + banner don't linger. Independent of the server timer.
        connectTimer: setTimeout(() => {
            if (session && !session.connected) {
                logger.warn("Live screen: peer did not connect in time — stopping.");
                stopSession("connect_failed", { notifyServer: true });
            }
        }, (config.liveScreenConnectTimeoutSeconds || 45) * 1000),
        answerApplied: false,
    };
    if (session.maxTimer && session.maxTimer.unref) session.maxTimer.unref();
    if (session.connectTimer.unref) session.connectTimer.unref();

    // 2. Capture window
    try {
        session.captureWin = openCaptureWindow(id, session.iceServers);
    } catch (err) {
        logger.error(`Live screen: capture window failed (${err.message}).`);
        await liveScreenClient.signal(config, { session_id: id, type: "error" });
        stopSession("error", { notifyServer: false });
    }
}

function stopSession(reason, { notifyServer = true } = {}) {
    if (!session) return;
    const id = session.id;
    logger.info(`Live screen: stopping session ${id} (${reason}).`);

    if (session.maxTimer) clearTimeout(session.maxTimer);
    if (session.connectTimer) clearTimeout(session.connectTimer);
    for (const win of [session.captureWin, session.bannerWin]) {
        try {
            if (win && !win.isDestroyed()) {
                win.webContents.send("ls:stop"); // let the renderer stop tracks first
                win.destroy();
            }
        } catch {
            /* ignore */
        }
    }
    session = null;

    if (notifyServer) {
        const type =
            reason === "stopped_by_employee"
                ? "stopped"
                : reason === "error" || reason === "connect_failed"
                    ? "error"
                    : "stopped";
        liveScreenClient
            .signal(config, { session_id: id, type })
            .catch(() => {});
    }
}

// --------------------------------------------------------------- poll loop

function idlePeriodMs() {
    return (config.liveScreenIdlePollIntervalSeconds || 5) * 1000;
}
function activePeriodMs() {
    return (config.liveScreenPollIntervalSeconds || 2) * 1000;
}

async function tick() {
    if (polling || !config) return;
    polling = true;
    try {
        const res = await liveScreenClient.poll(config);
        if (res.kind === "disabled" || res.kind === "auth") {
            if (session) stopSession(res.kind === "auth" ? "error" : "not_enabled", { notifyServer: false });
            orgEnabled = false;
            stopLoop();
            return;
        }
        if (res.kind !== "ok") return; // transient network/HTTP hiccup — keep the loop, keep the session

        const d = res.directive || { action: "none" };

        if (d.action === "start") {
            noneStreak = 0;
            if (!session) {
                await startSession(d);
            } else if (session.id === d.session_id) {
                applyViewerSignals(d);
            }
        } else if (d.action === "keep") {
            noneStreak = 0;
            if (session && session.id === d.session_id) applyViewerSignals(d);
        } else if (d.action === "stop") {
            // The server has a DEFINITE ended/error record for this session —
            // act on it immediately, this is not ambiguous.
            noneStreak = 0;
            if (session && (!d.session_id || d.session_id === session.id)) {
                stopSession("stopped_by_viewer", { notifyServer: false });
            }
        } else {
            // "none": the server has NO record of this session at all. Could be
            // a genuine end (e.g. the viewer's tab closed before a stop signal
            // landed) or a transient blip (a brief backend restart, a race
            // right after a reconnect). Tolerate a few consecutive "none"
            // polls before concluding the session is really gone, so one bad
            // poll never kills a live call.
            if (session) {
                noneStreak += 1;
                if (noneStreak >= NONE_STREAK_LIMIT) {
                    stopSession("viewer_disconnected", { notifyServer: false });
                    noneStreak = 0;
                }
            } else {
                noneStreak = 0;
            }
        }

        // Cadence: fast while something is pending/active, idle otherwise —
        // but only keep polling at all while the org has the feature enabled
        // or there is still a session to service.
        if (session || d.action !== "none") {
            ensurePolling(activePeriodMs());
        } else if (orgEnabled) {
            ensurePolling(idlePeriodMs());
        } else {
            stopLoop();
        }
    } catch (err) {
        logger.warn(`Live screen poll error: ${err.message}`);
    } finally {
        polling = false;
    }
}

function applyViewerSignals(directive) {
    if (!session || !session.captureWin || session.captureWin.isDestroyed()) return;
    if (directive.answer && !session.answerApplied) {
        session.answerApplied = true;
        session.captureWin.webContents.send("ls:answer", { sdp: directive.answer });
    }
    for (const candidate of directive.viewer_ice || []) {
        session.captureWin.webContents.send("ls:remoteIce", { candidate });
    }
}

// (Re)start the poll timer at `periodMs` if it isn't already running at that
// cadence. Always fires an immediate check when the cadence actually changes,
// so switching idle->active (a new request arriving) is picked up right away
// instead of waiting a full period.
function ensurePolling(periodMs) {
    if (!config) return;
    if (pollTimer && pollPeriodMs === periodMs) return;
    if (pollTimer) clearInterval(pollTimer);
    pollPeriodMs = periodMs;
    pollTimer = setInterval(() => {
        tick().catch((e) => logger.warn(`Live screen tick: ${e.message}`));
    }, periodMs);
    if (pollTimer.unref) pollTimer.unref();
    tick().catch(() => {});
    logger.info(`Live screen: polling every ${periodMs / 1000}s.`);
}

function stopLoop() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    pollPeriodMs = null;
    noneStreak = 0;
}

// --------------------------------------------------------------- IPC (once)

let ipcWired = false;
function wireIpc() {
    if (ipcWired) return;
    ipcWired = true;

    ipcMain.on("ls:offer", (_e, { sdp } = {}) => {
        if (!session || !sdp) return;
        liveScreenClient.signal(config, { session_id: session.id, type: "offer", sdp }).catch(() => {});
    });
    ipcMain.on("ls:ice", (_e, { candidate } = {}) => {
        if (!session || !candidate) return;
        liveScreenClient
            .signal(config, { session_id: session.id, type: "ice", candidate })
            .catch(() => {});
    });
    ipcMain.on("ls:connected", () => {
        if (!session) return;
        session.connected = true;
        if (session.connectTimer) {
            clearTimeout(session.connectTimer);
            session.connectTimer = null;
        }
        liveScreenClient.signal(config, { session_id: session.id, type: "connected" }).catch(() => {});
    });
    ipcMain.on("ls:error", (_e, { message } = {}) => {
        logger.warn(`Live screen: capture error: ${message || "unknown"}`);
        stopSession("error", { notifyServer: true });
    });
    ipcMain.on("ls:bannerStop", () => {
        stopSession("stopped_by_employee", { notifyServer: true });
    });
}

// --------------------------------------------------------------- public

/**
 * Called on every good heartbeat with the `live_screen` block.
 * { pending, legal_gate_open, consent_required, consented, document_version }
 * `consent_required` is true whenever the ORG has Live Screen enabled
 * (independent of this employee's own consent) — that's what starts idle
 * polling, so a new request is noticed within one idle interval instead of
 * waiting for the next heartbeat.
 */
function applyLiveScreenSignal(cfg, signal) {
    config = cfg;
    wireIpc();

    if (!signal || typeof signal !== "object") {
        orgEnabled = false;
        if (!session) stopLoop();
        return;
    }

    orgEnabled = Boolean(signal.consent_required);

    if (orgEnabled || signal.pending || session) {
        ensurePolling(session || signal.pending ? activePeriodMs() : idlePeriodMs());
    } else if (!session) {
        stopLoop();
    }
}

function shutdown() {
    stopSession("agent_shutdown", { notifyServer: true });
    stopLoop();
}

module.exports = { applyLiveScreenSignal, shutdown, isSessionActive };
