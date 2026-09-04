// Electron entry point.
//
// Background operation:
//   - Single instance only (app.requestSingleInstanceLock).
//   - Closing the window HIDES it; the process, tray, heartbeat and activity
//     tracking all keep running. "Exit Agent" in the tray is the only thing
//     that actually stops the agent.
//   - After a successful setup the agent enables Windows login auto-start; on a
//     later login it validates the saved credentials and resumes monitoring in
//     the background (tray only, window hidden) rather than on the employee's
//     screen.
//
// Startup flow:
//   app ready
//     -> load any saved config (env / agent.config.json / Electron secure store)
//     -> create the tray (always)
//     -> credentials present?
//          yes -> one validating heartbeat
//                   401  -> clear stored creds, disable auto-start, show setup UI
//                   else -> start heartbeat + activity tracking, window hidden
//          no  -> show setup UI, start nothing
//
// The setup UI (src/ui/index.html) talks to this process over IPC:
//   agent:getState     -> { mode, agent, deviceName, ... }
//   agent:connect      -> validate via heartbeat, save, enable auto-start, start
//   agent:reconfigure  -> stop monitoring, clear stored creds, back to setup
//
// The existing monitoring logic (heartbeat.js, tracker.js, ...) is used
// unchanged. The Agent Secret never leaves the main process / secure store and
// is never logged, never shown in the tray, never returned to the renderer.

const path = require("path");
const { app, BrowserWindow, ipcMain, powerMonitor } = require("electron");

const { buildConfig, validateConfig } = require("./config/config");
const { sendHeartbeat } = require("./auth/agentAuth");
const { startHeartbeatLoop, stopHeartbeatLoop } = require("./heartbeat");
const { startActivityTracking } = require("./monitoring/tracker");
const {
    initEventPipeline,
    startEventFlush,
    shutdownEventPipeline,
    discardEventPipeline,
    emitEvent,
    isInitialised: eventPipelineReady,
} = require("./monitoring/eventPipeline");
const {
    initContentPipeline,
    startContentFlush,
    shutdownContentPipeline,
    setActive: setContentActive,
    updateContentConfig,
} = require("./monitoring/contentPipeline");
const contentCaptureRunner = require("./monitoring/contentCaptureRunner");
const { decideContentAction } = require("./monitoring/contentConsentDecision");
const liveScreenController = require("./monitoring/liveScreen/liveScreenController");
const { postConsent } = require("./api/contentClient");
const {
    loadSecureConfig,
    saveSecureConfig,
    clearSecureConfig,
    encryptionAvailable,
} = require("./storage/secureConfig");
const consentStore = require("./storage/consentStore");
const { createTray } = require("./tray");
const { setAutoStart, isAutoStartEnabled, launchedHidden } = require("./autostart");
const logger = require("./utils/logger");

const DEFAULT_API_BASE_URL =
  "https://darkviolet-cobra-939760.hostingersite.com/api";

let mainWindow = null;
let tray = null;
let monitoring = null; // handle from startActivityTracking()
let monitoringStarted = false;
let powerMonitorWired = false;
let connectedAgent = null; // { agent_uuid, status, last_seen_at } from heartbeat
let connectedDeviceName = null;
let connectedApiBaseUrl = null;
let isQuitting = false; // true only while Exit Agent is running

// --------------------------------------------------------------- window

function createWindow({ show } = { show: true }) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (show) showWindow();
        return;
    }
    mainWindow = new BrowserWindow({
        width: 540,
        height: 640,
        resizable: false,
        show: Boolean(show),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));

    // Close button hides the window; it does NOT quit or stop monitoring.
    mainWindow.on("close", (event) => {
        if (isQuitting) return;
        event.preventDefault();
        mainWindow.hide();
        logger.info("Window hidden — monitoring continues in the background (tray).");
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

function showWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow({ show: true });
        return;
    }
    if (mainWindow.isMinimized && mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

// Trim, drop trailing slashes, require http(s). Returns null when unusable.
function normalizeApiUrl(value) {
    const trimmed = String(value || "").trim().replace(/\/+$/, "");
    if (!trimmed) return null;
    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
    }
    return trimmed;
}

// --------------------------------------------------------------- tray

function trayStatusLines() {
    const lines = [];
    if (connectedAgent && connectedAgent.agent_uuid) {
        lines.push(`Agent: ${connectedAgent.agent_uuid}`);
    }
    if (connectedApiBaseUrl) lines.push(`Server: ${connectedApiBaseUrl}`);
    if (connectedDeviceName) lines.push(`Device: ${connectedDeviceName}`);
    if (connectedAgent && connectedAgent.last_seen_at) {
        lines.push(`Last heartbeat: ${connectedAgent.last_seen_at}`);
    }
    lines.push(
        monitoringStarted
            ? "Heartbeat and activity monitoring are running."
            : "Monitoring is not running — setup required.",
    );
    return lines; // never contains the Agent Secret
}

function ensureTray() {
    if (tray) return tray;
    tray = createTray({
        onOpen: () => showWindow(),
        onReconfigure: async () => {
            showWindow();
            await handleReconfigure();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("agent:refresh");
            }
        },
        onExit: () => exitAgent(),
        getStatusLines: trayStatusLines,
    });
    return tray;
}

function setTrayState(state) {
    if (tray) tray.setState(state);
}

// --------------------------------------------------------------- lifecycle

function startMonitoring(config) {
    if (monitoringStarted) return;
    validateConfig(config);

    // Events pipeline first, so agent_start and the first events are captured
    // even if heartbeat/activity startup logs something. Fully skipped when
    // disabled — the legacy heartbeat + /activities path is unchanged.
    if (config.eventsPipelineEnabled) {
        try {
            initEventPipeline({
                dataDir: path.join(app.getPath("userData"), "events"),
                config,
            });
            startEventFlush();
        } catch (err) {
            logger.error(`Event pipeline failed to start: ${err.message}`);
        }
    }

    // §5b content pipeline — always initialised, always INACTIVE until a
    // heartbeat says otherwise. Nothing is captured or queued while inactive.
    try {
        initContentPipeline({ config });
        startContentFlush();
    } catch (err) {
        logger.error(`Content pipeline failed to start: ${err.message}`);
    }

    startHeartbeatLoop(config, (kind, result) => {
        if (!monitoringStarted) return;
        if (kind === "ok") setTrayState("MONITORING");
        else if (kind === "auth") setTrayState("AUTHENTICATION_FAILED");
        else if (kind === "network" || kind === "http") setTrayState("NETWORK_UNAVAILABLE");
        // Only act on a good heartbeat — a transient network failure must not
        // flap capture on/off.
        if (kind === "ok") {
            applyContentSignal(config, result && result.contentCapture);
            applyLiveScreenSignal(config, result && result.liveScreen);
        }
    });
    monitoring = startActivityTracking(config);
    monitoringStarted = true;
    connectedApiBaseUrl = config.apiBaseUrl;
    if (config.eventsPipelineEnabled) wirePowerMonitor();
    setTrayState("MONITORING");
    logger.info("Monitoring started (heartbeat + activity tracking).");
}

// The heartbeat's content_capture signal:
//   { active, legal_gate_open, org_enabled, consent_required, consented,
//     document_version, document_title?, document_text? }
//
// - `active === true` is the ONLY thing that starts capture; the server sets it
//   only when the legal gate is open AND the org enabled capture AND a consent
//   row exists.
// - `consent_required` (org has enabled capture) makes the agent show the
//   notice, even before the legal gate is flipped, so consent can be gathered
//   first. Decline / close simply never records consent, so capture never
//   becomes active.
let lastConsentPromptedVersion = null;
let lastConsentDocument = null; // { version, title, text } from the last heartbeat that needed it

function applyContentSignal(config, signal) {
    const decision = decideContentAction(signal, {
        promptedVersion: lastConsentPromptedVersion,
        hasLocalConsent: (v) => consentStore.hasConsentFor(v),
    });

    // Push the server's blocklist (hardcoded ∪ operator-tunable DB list) to the
    // capture runner regardless of the on/off decision — it's cheap and keeps
    // the list fresh for the next start.
    if (signal && Array.isArray(signal.blocklist_patterns)) {
        contentCaptureRunner.setPolicy({ blocklistPatterns: signal.blocklist_patterns });
    }

    if (decision.capture === "on") {
        if (decision.cacheConsent) {
            // Server confirms consent; mirror it locally so we don't re-prompt.
            try {
                consentStore.saveConsent(signal.document_version);
            } catch {
                /* local cache is non-critical */
            }
        }
        updateContentConfig(config);
        setContentActive(true);
        contentCaptureRunner.start(config);
        return;
    }

    // capture off
    if (setContentActive) setContentActive(false);
    contentCaptureRunner.stop();

    if (decision.prompt) {
        lastConsentPromptedVersion = decision.prompt.version;
        lastConsentDocument = { ...decision.prompt };
        promptForConsent(decision.prompt);
    }
}

function promptForConsent(doc) {
    logger.info(
        `Content-capture consent notice required (document ${doc.version}). Showing consent screen.`
    );
    showWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("content:consentRequired", {
            documentVersion: doc.version,
            documentTitle: doc.title,
            documentText: doc.text,
        });
    }
}

// Live Screen: drive the fast-poll loop and (separately) prompt for the
// live-screen consent notice, which is its OWN document — the §5b notice tells
// the employee their screen is not recorded, so live viewing needs explicit,
// separate consent. Reuses the same consent screen + POST /agent/consent.
let lastLiveConsentPromptedVersion = null;

function applyLiveScreenSignal(config, signal) {
    if (!signal || typeof signal !== "object") {
        liveScreenController.applyLiveScreenSignal(config, null);
        return;
    }

    const version = signal.document_version || null;
    const needConsent =
        signal.consent_required === true &&
        signal.consented !== true &&
        Boolean(version) &&
        typeof signal.document_text === "string" &&
        signal.document_text.trim().length > 0;

    if (
        needConsent &&
        lastLiveConsentPromptedVersion !== version &&
        !consentStore.hasConsentFor(version)
    ) {
        lastLiveConsentPromptedVersion = version;
        promptForConsent({
            version,
            title: signal.document_title || "Live Screen — Consent Required",
            text: signal.document_text,
        });
    }

    liveScreenController.applyLiveScreenSignal(config, signal);
}

// Electron powerMonitor lives in the main process only (no headless equivalent).
// Lock / unlock / suspend / resume are folded into the screen_state stream by
// the activity tracker's screen reducer. Listeners are attached once and simply
// no-op after monitoring stops (monitoring?.notifyPowerState is gone).
function wirePowerMonitor() {
    if (powerMonitorWired) return;
    powerMonitorWired = true;

    const relay = (patch) => {
        try {
            if (monitoring && typeof monitoring.notifyPowerState === "function") {
                monitoring.notifyPowerState(patch);
            }
        } catch (err) {
            logger.warn(`powerMonitor relay failed: ${err.message}`);
        }
    };

    powerMonitor.on("lock-screen", () => {
        logger.info("powerMonitor: session locked.");
        relay({ locked: true });
    });
    powerMonitor.on("unlock-screen", () => {
        logger.info("powerMonitor: session unlocked.");
        relay({ locked: false });
    });
    powerMonitor.on("suspend", () => {
        logger.info("powerMonitor: machine suspending.");
        relay({ suspended: true });
    });
    powerMonitor.on("resume", () => {
        logger.info("powerMonitor: machine resumed.");
        relay({ suspended: false });
    });
    // Windows delivers shutdown/restart via app "session-end" (handled below);
    // this listener is a harmless no-op there and covers other platforms.
    powerMonitor.on("shutdown", () => {
        logger.info("powerMonitor: system shutting down.");
    });

    logger.info("powerMonitor wired (lock / unlock / suspend / resume).");
}

async function stopMonitoring() {
    stopHeartbeatLoop();
    contentCaptureRunner.stop();
    // End any live-screen session immediately and stop the poll loop.
    try {
        liveScreenController.shutdown();
    } catch {
        /* best effort */
    }
    if (monitoring) {
        try {
            await monitoring.stopActivityTracking();
        } catch {
            /* best effort */
        }
        monitoring = null;
    }
    // Emit agent_stop and try one last flush of anything buffered.
    try {
        await shutdownEventPipeline({ reason: "monitoring_stopped" });
    } catch {
        /* best effort */
    }
    // Flush + clear the in-memory content queue (drops any unsent plaintext).
    try {
        await shutdownContentPipeline();
    } catch {
        /* best effort */
    }
    monitoringStarted = false;
}

async function handleReconfigure() {
    await stopMonitoring();
    // Credentials may now belong to a different agent enrolment — drop any
    // events still queued under the old identity.
    discardEventPipeline();
    // Consent is per-employee; a reconfigure may switch employees.
    consentStore.clearConsent();
    lastConsentPromptedVersion = null;
    clearSecureConfig();
    connectedAgent = null;
    connectedDeviceName = null;
    connectedApiBaseUrl = null;
    setTrayState("SETUP_REQUIRED");
    logger.info("Agent reconfigured — stored credentials cleared, monitoring stopped.");
    return { ok: true };
}

// The one explicit way to actually stop the agent.
async function exitAgent() {
    if (isQuitting) return;
    isQuitting = true;
    logger.info("Exit Agent requested — stopping monitoring and quitting.");
    setTrayState("STOPPED");
    await stopMonitoring();
    if (tray) {
        tray.destroy();
        tray = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
    app.quit();
}

function publicAgent() {
    if (!connectedAgent) return null;
    return {
        agent_uuid: connectedAgent.agent_uuid,
        status: connectedAgent.status,
        last_seen_at: connectedAgent.last_seen_at,
    };
}

// ---------------------------------------------------------------- IPC handlers

ipcMain.handle("agent:getState", () => ({
    mode: monitoringStarted ? "connected" : "setup",
    defaultApiBaseUrl: DEFAULT_API_BASE_URL,
    agent: publicAgent(),
    deviceName: connectedDeviceName,
    secureStorageAvailable: encryptionAvailable(),
    autoStartEnabled: isAutoStartEnabled(),
    backgroundHint:
        "You can close this window — the monitoring agent keeps running in the system tray.",
}));

ipcMain.handle("agent:connect", async (_event, payload) => {
    const apiBaseUrl = normalizeApiUrl(payload && payload.apiBaseUrl);
    const agentUuid = String((payload && payload.agentUuid) || "").trim();
    const agentSecret = String((payload && payload.agentSecret) || "");

    if (!apiBaseUrl) return { ok: false, code: "invalid_url" };
    if (!agentUuid || !agentSecret) return { ok: false, code: "missing" };

    if (!encryptionAvailable()) {
        return { ok: false, code: "no_secure_storage" };
    }

    // Validate against the EXISTING heartbeat endpoint. Nothing is persisted
    // and auto-start is NOT enabled until this succeeds.
    const probe = buildConfig({ apiBaseUrl, agentUuid, agentSecret });
    const result = await sendHeartbeat(probe);

    if (result.kind === "network") return { ok: false, code: "network" };
    if (result.kind === "auth") return { ok: false, code: "auth" };
    if (!result.ok) return { ok: false, code: "server_error", status: result.status };

    // A repeat connect with the identical, already-running agent is a no-op —
    // never thrash the monitoring loops.
    const sameAgent =
        monitoringStarted &&
        connectedAgent &&
        connectedAgent.agent_uuid === agentUuid &&
        connectedApiBaseUrl === apiBaseUrl;
    if (sameAgent) {
        return { ok: true, agent: publicAgent(), deviceName: connectedDeviceName };
    }

    // Reconfigure case (credentials changed): replace stored credentials only
    // AFTER successful validation, and stop existing monitoring exactly once.
    if (monitoringStarted) await stopMonitoring();

    try {
        saveSecureConfig({ apiBaseUrl, agentUuid, agentSecret });
    } catch {
        return { ok: false, code: "save_failed" };
    }

    // Credentials are valid and saved -> safe to enable Windows login auto-start.
    setAutoStart(true);

    connectedAgent =
        result.agent || { agent_uuid: agentUuid, status: "active", last_seen_at: null };
    connectedDeviceName = null;

    try {
        startMonitoring(buildConfig(loadSecureConfig() || {}));
    } catch (err) {
        logger.error(`Failed to start monitoring: ${err.message}`);
        return { ok: false, code: "start_failed" };
    }

    return { ok: true, agent: publicAgent(), deviceName: connectedDeviceName };
});

ipcMain.handle("agent:reconfigure", async () => handleReconfigure());

// -------------------------------------------------------------------- §5b consent

ipcMain.handle("content:getConsentState", () => {
    const pending = lastConsentPromptedVersion;
    const isPending = Boolean(pending && !consentStore.hasConsentFor(pending));
    return {
        pendingDocumentVersion: isPending ? pending : null,
        pendingDocumentTitle:
            isPending && lastConsentDocument ? lastConsentDocument.title : null,
        pendingDocumentText:
            isPending && lastConsentDocument ? lastConsentDocument.text : null,
        accepted: consentStore.loadConsent(),
    };
});

// The renderer's consent screen calls this when the employee accepts. We record
// it with the server FIRST (that row is what actually authorises capture), then
// cache locally. Capture still only starts on the next heartbeat that returns
// active:true.
ipcMain.handle("content:acceptConsent", async (_event, payload) => {
    const documentVersion = String((payload && payload.documentVersion) || "").trim();
    if (!documentVersion) return { ok: false, code: "missing_version" };

    const secure = loadSecureConfig();
    if (!secure) return { ok: false, code: "not_connected" };
    const config = buildConfig(secure);

    const res = await postConsent(config, { documentVersion, method: "agent" });
    if (res.kind === "mismatch") {
        return { ok: false, code: "version_mismatch", expected: res.expected };
    }
    if (res.kind !== "ok") {
        return { ok: false, code: res.kind || "failed" };
    }

    try {
        consentStore.saveConsent(documentVersion);
    } catch {
        /* local cache is non-critical */
    }
    logger.info(`Content capture consent accepted and recorded (document ${documentVersion}).`);
    return { ok: true };
});

// -------------------------------------------------------------------- startup

async function bootstrap() {
    ensureTray();

    const secure = loadSecureConfig();
    const config = buildConfig(secure || {});
    const hasCreds = Boolean(
        config.apiBaseUrl && config.agentUuid && config.agentSecret,
    );

    if (!hasCreds) {
        setTrayState("SETUP_REQUIRED");
        createWindow({ show: true });
        return;
    }

    const result = await sendHeartbeat(config);
    if (result.kind === "auth") {
        logger.warn(
            "Saved credentials were rejected by the server — showing the setup screen.",
        );
        if (secure) clearSecureConfig();
        setAutoStart(false); // do not auto-launch again with dead credentials
        setTrayState("SETUP_REQUIRED");
        createWindow({ show: true });
        return;
    }

    // ok, or a transient network/HTTP error: the heartbeat loop retries safely,
    // so proceed to the connected state.
    connectedAgent =
        result.agent || {
            agent_uuid: config.agentUuid,
            status: "active",
            last_seen_at: null,
        };
    connectedDeviceName = secure ? secure.deviceName : null;
    try {
        startMonitoring(config);
    } catch (err) {
        logger.error(`Failed to start monitoring: ${err.message}`);
    }

    // Resuming from a Windows login (or any restart with valid creds): stay in
    // the background/tray instead of forcing the window onto the screen.
    createWindow({ show: false });
    if (launchedHidden()) {
        logger.info("Launched hidden (login auto-start) — window stays in the tray.");
    }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock
    ? app.requestSingleInstanceLock()
    : true;

if (!gotSingleInstanceLock) {
    logger.warn("Another agent instance is already running — exiting this one.");
    app.quit();
} else {
    app.on("second-instance", () => {
        logger.info("Second instance launch detected — focusing the existing window.");
        showWindow();
    });

    app.whenReady().then(() => {
        bootstrap();

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow({ show: true });
            } else {
                showWindow();
            }
        });
    });

    // Window close hides the app; do NOT quit when all windows are gone. The
    // agent only exits via the tray's "Exit Agent" action (exitAgent()).
    app.on("window-all-closed", () => {
        logger.info("All windows closed — agent still running in the background (tray).");
    });

    app.on("before-quit", () => {
        isQuitting = true;
    });

    // Windows logoff / shutdown / restart. Record it as a clean end and try a
    // best-effort final flush — the OS may not give us much time.
    app.on("session-end", (event) => {
        const reason = (event && event.reason) || "unknown";
        logger.info(`Windows session ending (${reason}).`);
        if (eventPipelineReady()) {
            emitEvent("session_end", { signal: "windows_session_end", reason });
            shutdownEventPipeline({ reason: "session_end" }).catch(() => {});
        }
    });
}

// Exported for tests (Electron cannot be launched in CI).
module.exports = { bootstrap, exitAgent, __test: { trayStatusLines } };
