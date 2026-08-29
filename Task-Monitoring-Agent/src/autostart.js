// Windows login auto-start, using Electron's supported mechanism only
// (app.setLoginItemSettings). No third-party packages, no scheduled tasks,
// no Windows service — those are separate future deployment steps.
//
// Auto-start is only ever enabled AFTER credentials have been validated and
// saved (see main.js). It is disabled again if saved credentials turn out to
// be invalid on a later login.

const { app } = require("electron");
const logger = require("./utils/logger");

// Passed on the auto-start command line so a login-triggered launch starts in
// the background (tray only) instead of popping the window onto the screen.
const HIDDEN_FLAG = "--hidden";

function launchedHidden() {
    return process.argv.includes(HIDDEN_FLAG);
}

function setAutoStart(enabled) {
    if (process.platform !== "win32") return false;
    try {
        app.setLoginItemSettings({
            openAtLogin: Boolean(enabled),
            // Electron resolves the correct executable itself (app.getPath is not
            // needed here). In a packaged build this is the installed .exe; in
            // development it is electron.exe — documented as a dev limitation.
            args: enabled ? [HIDDEN_FLAG] : [],
        });
        logger.info(
            `Windows login auto-start ${enabled ? "enabled" : "disabled"}.`,
        );
        return true;
    } catch {
        logger.warn("Unable to update Windows login-item settings.");
        return false;
    }
}

function isAutoStartEnabled() {
    if (process.platform !== "win32") return false;
    try {
        return Boolean(app.getLoginItemSettings().openAtLogin);
    } catch {
        return false;
    }
}

module.exports = { setAutoStart, isAutoStartEnabled, launchedHidden, HIDDEN_FLAG };
