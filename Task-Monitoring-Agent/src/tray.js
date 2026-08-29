// Windows system-tray presence for the monitoring agent.
//
// Uses only Electron's built-in Tray / Menu / nativeImage — no third-party
// tray package. The tray keeps the agent visible as a normal background
// application: closing the window hides it, the tray stays, monitoring keeps
// running, and "Exit Agent" is the one explicit way to actually stop.
//
// The Agent Secret is NEVER placed in the tooltip, menu, or any status text.

const path = require("path");
const { Tray, Menu, nativeImage, dialog } = require("electron");
const logger = require("./utils/logger");

// Tray + tooltip wording for each agent state. Deliberately never says
// "Closed"/"Stopped" while monitoring is still running in the background.
const STATE_LABELS = {
    SETUP_REQUIRED: "Setup required",
    MONITORING: "Monitoring active",
    AUTHENTICATION_FAILED: "Authentication failed — reconfigure needed",
    NETWORK_UNAVAILABLE: "Backend unreachable — retrying, monitoring continues",
    STOPPED: "Stopped",
};

function iconImage() {
    try {
        const img = nativeImage.createFromPath(
            path.join(__dirname, "assets", "tray-icon.png"),
        );
        if (img && !img.isEmpty()) return img;
    } catch {
        /* fall through to empty image */
    }
    try {
        return nativeImage.createEmpty();
    } catch {
        return undefined;
    }
}

// callbacks: { onOpen, onReconfigure, onExit, getStatusLines }
function createTray(callbacks = {}) {
    const cb = callbacks || {};
    const tray = new Tray(iconImage());
    let state = "SETUP_REQUIRED";

    function label() {
        return STATE_LABELS[state] || String(state);
    }

    function showStatus() {
        const lines = (typeof cb.getStatusLines === "function" && cb.getStatusLines()) || [];
        try {
            dialog.showMessageBox({
                type: "info",
                title: "Task Monitoring Agent",
                message: label(),
                detail: lines.join("\n"),
                buttons: ["OK"],
                noLink: true,
            });
        } catch {
            /* no window manager available (headless) */
        }
    }

    function rebuild() {
        tray.setToolTip(`Task Monitoring Agent — ${label()}`);
        const menu = Menu.buildFromTemplate([
            { label: "Open Monitoring Agent", click: () => cb.onOpen && cb.onOpen() },
            { label: `Connection Status: ${label()}`, enabled: false },
            { label: "Show Connection Status…", click: showStatus },
            { type: "separator" },
            { label: "Reconfigure", click: () => cb.onReconfigure && cb.onReconfigure() },
            { type: "separator" },
            { label: "Exit Agent", click: () => cb.onExit && cb.onExit() },
        ]);
        tray.setContextMenu(menu);
    }

    try {
        tray.on("double-click", () => cb.onOpen && cb.onOpen());
    } catch {
        /* not all platforms emit this */
    }

    rebuild();
    logger.info("System tray created.");

    return {
        setState(next) {
            if (next && next !== state) {
                state = next;
                rebuild();
            }
        },
        getState() {
            return state;
        },
        destroy() {
            try {
                tray.destroy();
                logger.info("System tray destroyed.");
            } catch {
                /* already gone */
            }
        },
    };
}

module.exports = { createTray, STATE_LABELS };
