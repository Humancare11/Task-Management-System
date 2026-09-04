// Live Screen — HTTP transport (agent side).
//
// The agent has no persistent socket; it polls a lightweight endpoint ONLY
// while a session is pending/active and posts WebRTC signaling. No media goes
// over these calls — only SDP/ICE text.

const { postJson, NetworkError } = require("../../api/apiClient");

const POLL_PATH = "/monitoring/agent/livescreen";
const SIGNAL_PATH = "/monitoring/agent/livescreen/signal";

function creds(config) {
    return { agent_uuid: config.agentUuid, agent_secret: config.agentSecret };
}

function classify(err) {
    return err instanceof NetworkError ? "network" : "unknown";
}

/**
 * Ask the server what to do.
 * @returns {{kind:"ok", directive:object} | {kind:"disabled"|"auth"|"network"|"unknown"} | {kind:"http", status:number}}
 */
async function poll(config) {
    try {
        const r = await postJson(`${config.apiBaseUrl}${POLL_PATH}`, creds(config));
        if (r.status === 200) return { kind: "ok", directive: r.data || { action: "none" } };
        if (r.status === 501) return { kind: "disabled" };
        if (r.status === 401) return { kind: "auth" };
        return { kind: "http", status: r.status };
    } catch (err) {
        return { kind: classify(err) };
    }
}

/**
 * Post one signaling message.
 * @param {{session_id:string, type:"offer"|"ice"|"connected"|"stopped"|"error", sdp?:string, candidate?:object}} msg
 * @returns {{kind:"ok", data:object} | {kind:"disabled"|"network"|"unknown"} | {kind:"http", status:number}}
 */
async function signal(config, msg) {
    try {
        const r = await postJson(`${config.apiBaseUrl}${SIGNAL_PATH}`, {
            ...creds(config),
            ...msg,
        });
        if (r.status === 200) return { kind: "ok", data: r.data || {} };
        if (r.status === 501) return { kind: "disabled" };
        if (r.status === 401) return { kind: "auth" };
        return { kind: "http", status: r.status };
    } catch (err) {
        return { kind: classify(err) };
    }
}

module.exports = { poll, signal, POLL_PATH, SIGNAL_PATH };
