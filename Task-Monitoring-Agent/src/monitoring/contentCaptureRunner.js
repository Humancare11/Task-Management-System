// Wires the real IO into contentCapture.startContentCapture():
//   getForeground  <- activeWindow + domainDetector
//   readQueryField <- uiaReader (Windows UI Automation, focused element only)
//   emit           -> contentPipeline.emitContent (in-memory content queue)
//
// Started / stopped by main.js in response to the heartbeat's
// content_capture.active signal. Never runs otherwise.

const logger = require("../utils/logger");
const { getActiveWindow } = require("./activeWindow");
const { getActiveDomain, canonicalBrowser } = require("./domainDetector");
const { readFocusedField } = require("./uiaReader");
const { startContentCapture } = require("./contentCapture");
const contentPipeline = require("./contentPipeline");

let handle = null;

async function getForeground() {
    const win = await getActiveWindow();
    if (!win) return null;
    const browser = canonicalBrowser(win.applicationName);
    let domain = null;
    if (browser) {
        try {
            domain = await getActiveDomain(win);
        } catch {
            domain = null;
        }
    }
    return {
        applicationName: win.applicationName || "Unknown",
        windowTitle: win.windowTitle || "",
        domain: domain || null,
        isBrowser: Boolean(browser),
    };
}

async function readQueryField() {
    const field = await readFocusedField();
    if (!field) return null;
    return { text: field.text || "", isPassword: Boolean(field.isPassword) };
}

function start(config) {
    if (handle) return;
    logger.info("Content capture runner starting (allowlist: Google, YouTube, ChatGPT, Claude, Gemini).");
    handle = startContentCapture({
        config,
        getForeground,
        readQueryField,
        emit: (item) => contentPipeline.emitContent(item),
        // agent enforces the hardcoded fallback; server enforces the full DB list
        blocklistPatterns: undefined,
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

module.exports = { start, stop, isRunning };
