// Agent authentication against the backend heartbeat endpoint.
//
// The agent_secret is read from config and sent ONLY in the request body to
// POST /api/monitoring/agent/heartbeat. It is never logged, never returned to
// callers, and never sent anywhere else.

const { postJson, NetworkError } = require("../api/apiClient");

const HEARTBEAT_PATH = "/monitoring/agent/heartbeat";

/**
 * Perform a single heartbeat.
 * @returns {Promise<{ ok: boolean, status: number, kind: string, agent?: object }>}
 */
async function sendHeartbeat(config) {
    const url = `${config.apiBaseUrl}${HEARTBEAT_PATH}`;

    let result;
    try {
        result = await postJson(url, {
            agent_uuid: config.agentUuid,
            agent_secret: config.agentSecret,
        });
    } catch (err) {
        if (err instanceof NetworkError) {
            return { ok: false, status: 0, kind: "network" };
        }
        return { ok: false, status: 0, kind: "unknown" };
    }

    if (result.status === 200) {
        return {
            ok: true,
            status: 200,
            kind: "ok",
            agent: result.data && result.data.agent ? result.data.agent : null,
            // §5b signal: { active, legal_gate_open, org_enabled, consent_required,
            // consented, document_version }. Absent on older backends.
            contentCapture:
                result.data && result.data.content_capture
                    ? result.data.content_capture
                    : null,
        };
    }

    if (result.status === 401) {
        return { ok: false, status: 401, kind: "auth" };
    }

    return { ok: false, status: result.status, kind: "http" };
}

module.exports = { sendHeartbeat, HEARTBEAT_PATH };
