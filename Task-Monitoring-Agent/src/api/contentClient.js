// §5b content endpoints. Same agent_uuid + agent_secret credential as the
// heartbeat; the secret is only ever in the request body and is never logged.
//
// The plaintext of a captured search / prompt is placed in the request body
// here and NOWHERE else on the agent — it lives transiently in RAM, is written
// to the local content queue, and is discarded once the server accepts it.
// The server encrypts before storing; there is no plaintext column.

const { postJson, NetworkError } = require("./apiClient");

const CONTENT_PATH = "/monitoring/agent/content";
const CONSENT_PATH = "/monitoring/agent/consent";

/**
 * POST a batch of captured items.
 *   { kind:"ok", acceptedIds, inserted, dropped }  — server has them; drop locally
 *   { kind:"disabled", status }                     — 501/403: gate/org/consent off; drop locally, stop capturing
 *   { kind:"auth" } / { kind:"network" } / { kind:"http", status } / { kind:"unknown" } — keep
 */
async function postContent(config, items) {
    const url = `${config.apiBaseUrl}${CONTENT_PATH}`;

    let result;
    try {
        result = await postJson(url, {
            agent_uuid: config.agentUuid,
            agent_secret: config.agentSecret,
            items,
        });
    } catch (err) {
        if (err instanceof NetworkError) return { kind: "network" };
        return { kind: "unknown" };
    }

    if (result.status === 201 || result.status === 200) {
        const data = result.data || {};
        const acceptedIds = Array.isArray(data.accepted_event_ids)
            ? data.accepted_event_ids
            : items.map((i) => i.client_event_id);
        return {
            kind: "ok",
            acceptedIds,
            inserted: typeof data.inserted_count === "number" ? data.inserted_count : null,
            dropped: Array.isArray(data.dropped) ? data.dropped : [],
        };
    }

    // 501 (legal gate closed) or 403 (org disabled / no consent): the server is
    // telling us to not be doing this. Drop the batch and let the caller stop.
    if (result.status === 501 || result.status === 403) {
        return { kind: "disabled", status: result.status };
    }

    if (result.status === 401) return { kind: "auth" };
    return { kind: "http", status: result.status };
}

/**
 * Record the employee's consent acceptance.
 *   { kind:"ok" } | { kind:"mismatch", expected } | { kind:"auth" } | { kind:"network" } | { kind:"http", status }
 */
async function postConsent(config, { documentVersion, method = "agent" }) {
    const url = `${config.apiBaseUrl}${CONSENT_PATH}`;

    let result;
    try {
        result = await postJson(url, {
            agent_uuid: config.agentUuid,
            agent_secret: config.agentSecret,
            document_version: documentVersion,
            method,
        });
    } catch (err) {
        if (err instanceof NetworkError) return { kind: "network" };
        return { kind: "unknown" };
    }

    if (result.status === 200 || result.status === 201) {
        return { kind: "ok", data: result.data || {} };
    }
    if (result.status === 409) {
        return {
            kind: "mismatch",
            expected: result.data && result.data.expected_document_version,
        };
    }
    if (result.status === 401) return { kind: "auth" };
    return { kind: "http", status: result.status };
}

module.exports = { postContent, postConsent, CONTENT_PATH, CONSENT_PATH };
