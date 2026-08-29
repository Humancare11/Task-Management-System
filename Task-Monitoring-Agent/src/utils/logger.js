// Minimal timestamped logger. It intentionally has no way to pretty-print
// arbitrary objects — callers must pass only safe, explicit strings so that
// secrets (agent_secret, auth headers, raw request bodies) can never leak.

function stamp() {
    return new Date().toISOString();
}

function info(message) {
    console.log(`[${stamp()}] INFO  ${message}`);
}

function warn(message) {
    console.warn(`[${stamp()}] WARN  ${message}`);
}

function error(message) {
    console.error(`[${stamp()}] ERROR ${message}`);
}

module.exports = { info, warn, error };
