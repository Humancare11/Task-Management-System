// Headless entry point: runs the heartbeat loop, the active-application
// tracking loop, AND (unless disabled) the raw events pipeline — without the
// Electron window. Usage: npm run agent
//
// Credentials come from agent.config.json or environment variables
// (see src/config/config.js). Ctrl+C to stop.

const os = require("os");
const path = require("path");

const { buildConfig } = require("./config/config");
const { startHeartbeatLoop, stopHeartbeatLoop } = require("./heartbeat");
const { startActivityTracking } = require("./monitoring/tracker");
const {
    initEventPipeline,
    startEventFlush,
    shutdownEventPipeline,
} = require("./monitoring/eventPipeline");
const logger = require("./utils/logger");

let activity = null;
let config = null;

try {
    config = buildConfig();

    if (config.eventsPipelineEnabled) {
        const baseDir =
            process.env.AGENT_DATA_DIR ||
            path.join(os.homedir(), ".task-monitoring-agent");
        initEventPipeline({
            dataDir: path.join(baseDir, "events"),
            config,
        });
        startEventFlush();
    }

    startHeartbeatLoop(config);
    activity = startActivityTracking(config);
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
    try {
        await shutdownEventPipeline({ reason: "sigint" });
    } catch {
        // best effort on shutdown
    }
    logger.info("Monitoring agent stopped");
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
