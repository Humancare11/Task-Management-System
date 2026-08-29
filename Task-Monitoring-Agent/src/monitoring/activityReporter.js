// Submits completed activity sessions to the existing backend endpoint
//   POST /api/monitoring/agent/activities
// using the same agent_uuid + agent_secret credential as the heartbeat.
//
// The agent_secret is only ever placed in the request body. It is never logged.
//
// Unsent activities are kept in an in-memory buffer. If a submission fails
// (auth / network / HTTP), the activities remain buffered and are retried on
// the next submission attempt. Nothing is written to disk in this step.

const { postJson, NetworkError } = require("../api/apiClient");
const logger = require("../utils/logger");

const ACTIVITIES_PATH = "/monitoring/agent/activities";

class ActivityReporter {
    constructor(config) {
        this.config = config;
        this.buffer = [];
        this.maxBufferSize = config.activityBufferMaxSize;
    }

    add(activity) {
        this.buffer.push(activity);
    }

    get pendingCount() {
        return this.buffer.length;
    }

    shouldFlush() {
        return this.buffer.length >= this.maxBufferSize;
    }

    async flush() {
        if (this.buffer.length === 0) {
            return { kind: "empty" };
        }

        // Snapshot what we are trying to send; keep it buffered until success.
        const batch = this.buffer.slice();
        const url = `${this.config.apiBaseUrl}${ACTIVITIES_PATH}`;

        let result;
        try {
            result = await postJson(url, {
                agent_uuid: this.config.agentUuid,
                agent_secret: this.config.agentSecret,
                activities: batch,
            });
        } catch (err) {
            if (err instanceof NetworkError) {
                logger.warn(
                    `Activity submission failed: backend unavailable. ${batch.length} activity(ies) retained.`,
                );
                return { kind: "network" };
            }
            logger.warn(
                `Activity submission failed: unexpected error. ${batch.length} activity(ies) retained.`,
            );
            return { kind: "unknown" };
        }

        if (result.status === 201) {
            const inserted =
                result.data && typeof result.data.inserted_count === "number"
                    ? result.data.inserted_count
                    : batch.length;
            // Drop exactly what we sent (buffer may have grown meanwhile).
            this.buffer.splice(0, batch.length);
            logger.info(`Activities submitted: ${inserted}`);
            return { kind: "ok", inserted };
        }

        if (result.status === 401) {
            logger.warn(
                `Activity submission failed: authentication failed. ${batch.length} activity(ies) retained.`,
            );
            return { kind: "auth" };
        }

        logger.warn(
            `Activity submission failed: backend returned HTTP ${result.status}. ${batch.length} activity(ies) retained.`,
        );
        return { kind: "http", status: result.status };
    }
}

module.exports = { ActivityReporter, ACTIVITIES_PATH };
