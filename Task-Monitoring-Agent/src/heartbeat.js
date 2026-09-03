// Heartbeat scheduler.
//
// Sends one heartbeat immediately on start, then every
// config.heartbeatIntervalSeconds. A failed heartbeat (auth, HTTP, or network)
// is logged safely and the loop keeps running — a temporary backend/network
// outage must never permanently stop the agent.

const { buildConfig, validateConfig } = require("./config/config");
const { sendHeartbeat } = require("./auth/agentAuth");
const { emitEvent } = require("./monitoring/eventPipeline");
const logger = require("./utils/logger");

let timer = null;

async function beat(config, onResult) {
    // Emit the liveness event regardless of the HTTP outcome — the server uses
    // the last heartbeat event to bound an unclean-shutdown session. No-op when
    // the events pipeline is not running.
    emitEvent("heartbeat", {});

    const result = await sendHeartbeat(config);

    if (typeof onResult === "function") {
        try {
            // (kind, fullResult) — fullResult carries agent + contentCapture
            // signal. Existing observers that take only `kind` are unaffected.
            onResult(result.kind, result);
        } catch {
            /* a bad observer must never break the loop */
        }
    }

    switch (result.kind) {
        case "ok": {
            const lastSeen = result.agent && result.agent.last_seen_at
                ? result.agent.last_seen_at
                : "(not reported)";
            logger.info("Heartbeat successful");
            logger.info(`Agent: ${config.agentUuid}`);
            logger.info(`Last seen: ${lastSeen}`);
            break;
        }
        case "auth":
            logger.warn("Heartbeat authentication failed.");
            break;
        case "network":
            logger.warn("Heartbeat failed: backend unavailable.");
            break;
        case "http":
            logger.warn(`Heartbeat failed: backend returned HTTP ${result.status}.`);
            break;
        default:
            logger.warn("Heartbeat failed: unexpected error.");
    }
}

// onResult (optional): called with the heartbeat result kind ("ok" | "auth" |
// "network" | "http" | ...) after every beat. Used by the Electron shell to
// reflect connection state in the tray. Never receives the Agent Secret.
function startHeartbeatLoop(providedConfig, onResult) {
    const config = providedConfig || buildConfig();
    validateConfig(config);

    logger.info("Monitoring agent started");
    logger.info(`Heartbeat interval: ${config.heartbeatIntervalSeconds}s`);

    // Fire once now, then on the interval.
    beat(config, onResult).catch(() => logger.warn("Heartbeat failed: unexpected error."));

    timer = setInterval(() => {
        beat(config, onResult).catch(() => logger.warn("Heartbeat failed: unexpected error."));
    }, config.heartbeatIntervalSeconds * 1000);

    if (timer.unref) {
        // Do not keep a bare Node process alive solely for the timer during tests.
        timer.unref();
    }

    return timer;
}

function stopHeartbeatLoop() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

module.exports = { startHeartbeatLoop, stopHeartbeatLoop };
