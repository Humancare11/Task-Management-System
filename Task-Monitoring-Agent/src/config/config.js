// Agent configuration loader.
//
// Resolution order (first match wins per field):
//   1. Environment variables
//        AGENT_API_BASE_URL
//        AGENT_UUID
//        AGENT_SECRET
//        HEARTBEAT_INTERVAL_SECONDS
//        ACTIVITY_POLL_INTERVAL_SECONDS
//        ACTIVITY_BUFFER_MAX_SIZE
//        IDLE_THRESHOLD_SECONDS
//   2. The optional `fallback` object passed to buildConfig(). This is how the
//      Electron first-time setup UI feeds in the credentials the employee
//      entered (decrypted from secure storage). It sits above the JSON file so
//      a completed UI setup wins over a stale agent.config.json, but still
//      below environment variables so CI / developer overrides keep working.
//   3. A local JSON file (default: <agent root>/agent.config.json,
//      or the path in AGENT_CONFIG_PATH)
//
// The real agent_secret must only ever live in the local file, the environment,
// or the OS-encrypted Electron store — never in committed source.
// agent.config.json is gitignored.

const fs = require("fs");
const path = require("path");

const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 30;
const DEFAULT_ACTIVITY_POLL_INTERVAL_SECONDS = 5;
const DEFAULT_ACTIVITY_BUFFER_MAX_SIZE = 10;
const DEFAULT_IDLE_THRESHOLD_SECONDS = 60;

function positiveNumberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function loadFileConfig() {
    const configPath =      
        process.env.AGENT_CONFIG_PATH ||
        path.join(__dirname, "..", "..", "agent.config.json");

    if (!fs.existsSync(configPath)) {
        return {};
    }

    try {
        const raw = fs.readFileSync(configPath, "utf8");
        return JSON.parse(raw);
    } catch (err) {
        throw new Error(`Unable to read agent config file at ${configPath}: ${err.message}`);
    }
}

function buildConfig(fallback = {}) {
    const fileConfig = loadFileConfig();
    const fb = fallback || {};

    // env var  >  fallback (Electron setup UI)  >  agent.config.json
    const layered = (envKey, key) =>
        process.env[envKey] || fb[key] || fileConfig[key] || "";

    const apiBaseUrl = layered("AGENT_API_BASE_URL", "apiBaseUrl");
    const agentUuid = layered("AGENT_UUID", "agentUuid");
    const agentSecret = layered("AGENT_SECRET", "agentSecret");

    return {
        apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
        agentUuid,
        agentSecret,
        heartbeatIntervalSeconds: positiveNumberOr(
            layered("HEARTBEAT_INTERVAL_SECONDS", "heartbeatIntervalSeconds"),
            DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
        ),
        activityPollIntervalSeconds: positiveNumberOr(
            layered("ACTIVITY_POLL_INTERVAL_SECONDS", "activityPollIntervalSeconds"),
            DEFAULT_ACTIVITY_POLL_INTERVAL_SECONDS,
        ),
        activityBufferMaxSize: positiveNumberOr(
            layered("ACTIVITY_BUFFER_MAX_SIZE", "activityBufferMaxSize"),
            DEFAULT_ACTIVITY_BUFFER_MAX_SIZE,
        ),
        idleThresholdSeconds: positiveNumberOr(
            layered("IDLE_THRESHOLD_SECONDS", "idleThresholdSeconds"),
            DEFAULT_IDLE_THRESHOLD_SECONDS,
        ),
    };
}

function validateConfig(config) {
    const missing = [];
    if (!config.apiBaseUrl) missing.push("apiBaseUrl");
    if (!config.agentUuid) missing.push("agentUuid");
    if (!config.agentSecret) missing.push("agentSecret");

    if (missing.length > 0) {
        throw new Error(
            `Missing required agent configuration: ${missing.join(", ")}. ` +
            `Copy agent.config.example.json to agent.config.json and fill it in.`,
        );
    }
}

module.exports = {
    buildConfig,
    validateConfig,
    DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
    DEFAULT_ACTIVITY_POLL_INTERVAL_SECONDS,
    DEFAULT_ACTIVITY_BUFFER_MAX_SIZE,
    DEFAULT_IDLE_THRESHOLD_SECONDS,
};
