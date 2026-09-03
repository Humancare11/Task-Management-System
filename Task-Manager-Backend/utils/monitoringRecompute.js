"use strict";

/**
 * Debounced enqueue for the derivation engine.
 *
 * On every successful event ingest, the affected (agent_id, local_date) pairs
 * are enqueued here — keyed on each event's OWN local_date, so a week-old
 * offline sync re-derives each of those days (not just "today"). Repeated
 * enqueues coalesce onto one row via UNIQUE (agent_id, local_date) and push
 * not_before forward.
 *
 * Phase 1 only PRODUCES queue rows. The consumer (the recompute runner) is
 * Phase 2 — until then rows simply accumulate (bounded by agents × days).
 *
 * SINGLE-INSTANCE ASSUMPTION applies to the future consumer, not to this
 * producer (upsert is safe under concurrency).
 */

const { MonitoringRecomputeQueue } = require("../models");

const DEBOUNCE_MS =
  Number(process.env.MONITORING_RECOMPUTE_DEBOUNCE_MS) > 0
    ? Number(process.env.MONITORING_RECOMPUTE_DEBOUNCE_MS)
    : 45 * 1000;

/**
 * @param {object} params
 * @param {number} params.agentId
 * @param {string[]} params.localDates  distinct "YYYY-MM-DD" strings
 * @param {import("sequelize").Transaction} [params.transaction]
 */
async function enqueueRecompute({ agentId, localDates, transaction }) {
  if (!agentId || !Array.isArray(localDates) || localDates.length === 0) return;

  const notBefore = new Date(Date.now() + DEBOUNCE_MS);
  const unique = [...new Set(localDates)];

  for (const localDate of unique) {
    // INSERT ... ON DUPLICATE KEY UPDATE status='pending', not_before=<new>.
    // attempts / last_error are intentionally left as-is.
    // eslint-disable-next-line no-await-in-loop
    await MonitoringRecomputeQueue.upsert(
      {
        agent_id: agentId,
        local_date: localDate,
        status: "pending",
        not_before: notBefore,
      },
      { transaction }
    );
  }
}

module.exports = { enqueueRecompute, DEBOUNCE_MS };
