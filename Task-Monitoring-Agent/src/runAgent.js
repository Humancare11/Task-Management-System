// Headless entry point: runs the heartbeat loop AND the active-application
// tracking loop without the Electron window. Usage: npm run agent
//
// Credentials come from agent.config.json or environment variables
// (see src/config/config.js). Ctrl+C to stop.

const { startHeartbeatLoop, stopHeartbeatLoop } = require("./heartbeat");
const { startActivityTracking } = require("./monitoring/tracker");
const logger = require("./utils/logger");

let activity = null;

try {
    startHeartbeatLoop();
    activity = startActivityTracking();
} catch (err) {
    logger.error(err.message);
    process.exit(1);
}

const keepAlive = setInterval(() => {}, 60 * 60 * 1000);

async function shutdown() {
    clearInterval(keepAlive);
    stopHeartbeatLoop();
    if (activity) {
        try {
            await activity.stopActivityTracking();
        } catch {
            // best effort on shutdown
        }
    }
    logger.info("Monitoring agent stopped");
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
