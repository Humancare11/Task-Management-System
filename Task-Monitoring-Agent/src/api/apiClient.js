// Tiny JSON HTTP client for talking to the monitoring backend.
// Uses the global fetch (Node 18+ / Electron). No third-party dependencies.
//
// It never logs request bodies or headers — callers get back only
// { status, data } and are responsible for logging safely.

class NetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = "NetworkError";
    }
}

async function postJson(url, body) {
    let response;

    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    } catch (err) {
        // DNS failure, connection refused, timeout, etc.
        throw new NetworkError(err.message);
    }

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    return { status: response.status, data };
}

module.exports = { postJson, NetworkError };
