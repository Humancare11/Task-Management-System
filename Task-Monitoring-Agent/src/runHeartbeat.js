// Headless entry point for running / testing the heartbeat loop without the
// Electron window. Usage: npm run heartbeat
//
// Real credentials come from agent.config.json or environment variables
// (see src/config/config.js). Ctrl+C to stop.

const { startHeartbeatLoop, stopHeartbeatLoop } = require("./heartbeat");
const logger = require("./utils/logger");

try {
    startHeartbeatLoop();
} catch (err) {
    logger.error(err.message);
    process.exit(1);
}

// Keep the process alive between heartbeats.
const keepAlive = setInterval(() => {}, 60 * 60 * 1000);

function shutdown() {
    clearInterval(keepAlive);
    stopHeartbeatLoop();
    logger.info("Monitoring agent stopped");
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
