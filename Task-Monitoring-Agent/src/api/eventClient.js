// Submits batches of raw events to POST /api/monitoring/agent/events using the
// same agent_uuid + agent_secret credential as the heartbeat. The secret is
// only ever placed in the request body and is never logged.
//
// Returns a discriminated result:
//   { kind: "ok", acceptedIds, inserted }   — server has these events; drop them
//   { kind: "auth" }                          — 401; keep and retry later
//   { kind: "network" }                       — backend unreachable; keep
//   { kind: "http", status }                  — other HTTP error; keep
//   { kind: "unknown" }                       — unexpected; keep

const { postJson, NetworkError } = require("./apiClient");

const EVENTS_PATH = "/monitoring/agent/events";

async function postEvents(config, events) {
    const url = `${config.apiBaseUrl}${EVENTS_PATH}`;

    let result;
    try {
        result = await postJson(url, {
            agent_uuid: config.agentUuid,
            agent_secret: config.agentSecret,
            events,
        });
    } catch (err) {
        if (err instanceof NetworkError) return { kind: "network" };
        return { kind: "unknown" };
    }

    if (result.status === 201) {
        const acceptedIds =
            result.data && Array.isArray(result.data.accepted_event_ids)
                ? result.data.accepted_event_ids
                : events.map((e) => e.client_event_id);
        const inserted =
            result.data && typeof result.data.inserted_count === "number"
                ? result.data.inserted_count
                : null;
        return { kind: "ok", acceptedIds, inserted };
    }

    if (result.status === 401) return { kind: "auth" };

    return { kind: "http", status: result.status };
}

module.exports = { postEvents, EVENTS_PATH };
