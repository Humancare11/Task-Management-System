// Wires the real IO into contentCapture.startContentCapture():
//   getForeground  <- activeWindow + domainDetector (full host + registrable domain)
//   readQueryField <- uiaReader (Windows UI Automation, focused element only)
//   emit           -> contentPipeline.emitContent (in-memory content queue)
//
// Started / stopped by main.js in response to the heartbeat's
// content_capture.active signal. Never runs otherwise.
//
// setPolicy() lets main.js push the server-provided blocklist (hardcoded ∪ the
// operator-tunable DB list) from each heartbeat; capture uses the latest value
// live, and always falls back to the agent's hardcoded blocklist if the server
// sent nothing.

const logger = require("../utils/logger");
const { getActiveWindow } = require("./activeWindow");
const { getActiveHostInfo, canonicalBrowser } = require("./domainDetector");
const { readFocusedField } = require("./uiaReader");
const { startContentCapture } = require("./contentCapture");
const contentPipeline = require("./contentPipeline");

let handle = null;
let blocklistPatterns; // undefined -> contentCapture falls back to the hardcoded list

/** Push the latest server policy (currently just the blocklist). */
function setPolicy(policy) {
    if (policy && Array.isArray(policy.blocklistPatterns) && policy.blocklistPatterns.length) {
        blocklistPatterns = policy.blocklistPatterns;
    }
}

async function getForeground() {
    const win = await getActiveWindow();
    if (!win) return null;
    const browser = canonicalBrowser(win.applicationName);
    let host = null;
    let registrableDomain = null;
    if (browser) {
        try {
            const info = await getActiveHostInfo(win);
            if (info) {
                host = info.host;
                registrableDomain = info.registrableDomain;
            }
        } catch {
            host = null;
        }
    }
    return {
        applicationName: win.applicationName || "Unknown",
        windowTitle: win.windowTitle || "",
        host,
        registrableDomain,
        isBrowser: Boolean(browser),
    };
}

async function readQueryField() {
    const field = await readFocusedField();
    if (!field) return null;
    return {
        text: field.text || "",
        isPassword: Boolean(field.isPassword),
        controlType: field.controlType || "",
        name: field.name || "",
        automationId: field.automationId || "",
        ariaRole: field.ariaRole || "",
        localizedControlType: field.localizedControlType || "",
    };
}

function start(config) {
    if (handle) return;
    logger.info(
        "Content capture runner starting (all-site search-field capture; " +
        "AI-assistant prompts: ChatGPT, Claude, Gemini; blocklist enforced).",
    );
    handle = startContentCapture({
        config,
        getForeground,
        readQueryField,
        emit: (item) => contentPipeline.emitContent(item),
        // server list (hardcoded ∪ DB) when available; contentCapture falls back
        // to the agent's hardcoded blocklist when this is undefined.
        blocklistPatterns: () => blocklistPatterns,
    });
}

function stop() {
    if (!handle) return;
    try {
        handle.stop();
    } catch (err) {
        logger.warn(`Content capture runner stop failed: ${err.message}`);
    }
    handle = null;
}

function isRunning() {
    return Boolean(handle);
}

module.exports = { start, stop, isRunning, setPolicy };
