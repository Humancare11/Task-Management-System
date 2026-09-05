// Screenshot — HTTP transport (agent side).
//
// A SEPARATE feature from Live Screen: no WebRTC, no signaling, no persistent
// session. The agent polls a lightweight endpoint for a pending capture
// request and, when there is one, uploads a single PNG once. That is the
// entire protocol.

const { postJson, NetworkError } = require("../../api/apiClient");

const POLL_PATH = "/monitoring/agent/screenshot";
const UPLOAD_PATH = "/monitoring/agent/screenshot/upload";

function creds(config) {
    return { agent_uuid: config.agentUuid, agent_secret: config.agentSecret };
}

function classify(err) {
    return err instanceof NetworkError ? "network" : "unknown";
}

/**
 * Ask the server whether a screenshot is pending for this agent.
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
 * Upload the captured PNG (base64) for one request, or report a capture
 * failure. Exactly one of `imageBase64` / `error` is provided by the caller.
 * @returns {{kind:"ok"} | {kind:"disabled"|"auth"|"network"|"unknown"} | {kind:"http", status:number}}
 */
async function upload(config, { requestId, imageBase64, error } = {}) {
    try {
        const body = { ...creds(config), request_id: requestId };
        if (error) body.error = error;
        else body.image_base64 = imageBase64;
        const r = await postJson(`${config.apiBaseUrl}${UPLOAD_PATH}`, body);
        if (r.status === 200) return { kind: "ok" };
        if (r.status === 501) return { kind: "disabled" };
        if (r.status === 401) return { kind: "auth" };
        return { kind: "http", status: r.status };
    } catch (err) {
        return { kind: classify(err) };
    }
}

module.exports = { poll, upload, POLL_PATH, UPLOAD_PATH };
