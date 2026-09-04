"use strict";

/**
 * Recompute runner (Phase 2) — the consumer that drains monitoring_recompute_queue.
 *
 * SINGLE-INSTANCE ASSUMPTION: this runner assumes exactly one backend process.
 * It claims a row with a plain SELECT + guarded UPDATE (status='pending' ->
 * 'running'). If this service is ever scaled to multiple instances, switch the
 * claim to `SELECT ... FOR UPDATE SKIP LOCKED` (or move to a real job system) so
 * two instances never derive the same (agent_id, local_date) at once.
 *
 * Two loops:
 *   - drain loop  : every ~30s, process up to MAX_PER_TICK due rows.
 *   - nightly pass : every 24h (and ~30s after start), enqueue (a) every
 *                    (agent, local_date) that received events in the last 24h,
 *                    and (b) every still-provisional device-day from a past
 *                    date, so provisional sessions get finalised.
 */

const { Op } = require("sequelize");
const {
  MonitoringRecomputeQueue,
  MonitoringEvent,
  MonitoringPcSession,
} = require("../models");
const { recomputeDay } = require("./monitoringDerivation");
const { enqueueRecompute } = require("../utils/monitoringRecompute");
const { serverLocalDate } = require("../utils/monitoringTime");

const DRAIN_INTERVAL_MS =
  Number(process.env.MONITORING_DRAIN_INTERVAL_MS) > 0
    ? Number(process.env.MONITORING_DRAIN_INTERVAL_MS)
    : 30 * 1000;
const NIGHTLY_INTERVAL_MS =
  Number(process.env.MONITORING_NIGHTLY_INTERVAL_MS) > 0
    ? Number(process.env.MONITORING_NIGHTLY_INTERVAL_MS)
    : 24 * 60 * 60 * 1000;

const MAX_PER_TICK = 50;
const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = 5 * 60 * 1000;
// If a drain has held the lock longer than this it is presumed hung (a stalled
// DB call, a process that was frozen mid-drain by the host); the next caller
// force-resets so the queue can never wedge permanently.
const DRAIN_STALL_MS =
  Number(process.env.MONITORING_DRAIN_STALL_MS) > 0
    ? Number(process.env.MONITORING_DRAIN_STALL_MS)
    : 3 * 60 * 1000;
// A row left in 'running' longer than this is an orphan — the process that
// claimed it died mid-derive (a redeploy, or a shared host killing an idle
// worker). Reclaim it to 'pending' so it is retried instead of stuck forever.
const RUNNING_STALE_MS =
  Number(process.env.MONITORING_RUNNING_STALE_MS) > 0
    ? Number(process.env.MONITORING_RUNNING_STALE_MS)
    : 10 * 60 * 1000;

let drainTimer = null;
let nightlyTimer = null;
let draining = false;
let drainStartedAt = 0;
let started = false;

function isEnabled() {
  return String(process.env.MONITORING_RECOMPUTE_RUNNER_ENABLED || "true") !== "false";
}

// Return orphaned 'running' rows to 'pending'. Cheap; run once per drain.
async function reclaimStaleRunning() {
  const [n] = await MonitoringRecomputeQueue.update(
    { status: "pending" },
    {
      where: {
        status: "running",
        updated_at: { [Op.lt]: new Date(Date.now() - RUNNING_STALE_MS) },
      },
    }
  );
  if (n > 0) {
    console.warn(`Recompute: reclaimed ${n} orphaned 'running' row(s) to 'pending'.`);
  }
}

async function claimOne() {
  const row = await MonitoringRecomputeQueue.findOne({
    where: { status: "pending", not_before: { [Op.lte]: new Date() } },
    order: [["not_before", "ASC"]],
  });
  if (!row) return null;

  const [affected] = await MonitoringRecomputeQueue.update(
    { status: "running", attempts: row.attempts + 1 },
    { where: { id: row.id, status: "pending" } }
  );
  if (!affected) return null; // someone/thing else took it (not expected single-instance)
  return row;
}

async function finishOne(row, err) {
  if (!err) {
    // Only clear it if nothing re-enqueued it while we were deriving (an event
    // that arrived mid-recompute flips status back to 'pending').
    await MonitoringRecomputeQueue.destroy({
      where: { id: row.id, status: "running" },
    });
    return;
  }

  const message = String(err && err.message ? err.message : err).slice(0, 1000);
  if (row.attempts + 1 >= MAX_ATTEMPTS) {
    await MonitoringRecomputeQueue.update(
      { status: "error", last_error: message },
      { where: { id: row.id, status: "running" } }
    );
  } else {
    await MonitoringRecomputeQueue.update(
      {
        status: "pending",
        not_before: new Date(Date.now() + RETRY_BACKOFF_MS),
        last_error: message,
      },
      { where: { id: row.id, status: "running" } }
    );
  }
}

async function drainOnce() {
  if (draining) {
    if (Date.now() - drainStartedAt > DRAIN_STALL_MS) {
      console.error(
        `Recompute drain held for >${DRAIN_STALL_MS}ms — assuming it is hung and resetting.`
      );
      draining = false;
    } else {
      return;
    }
  }
  draining = true;
  drainStartedAt = Date.now();
  try {
    await reclaimStaleRunning();
    for (let i = 0; i < MAX_PER_TICK; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const row = await claimOne();
      if (!row) break;
      try {
        // eslint-disable-next-line no-await-in-loop
        await recomputeDay(row.agent_id, row.local_date);
        // eslint-disable-next-line no-await-in-loop
        await finishOne(row, null);
      } catch (err) {
        console.error(
          `Recompute failed for agent ${row.agent_id} ${row.local_date}:`,
          err
        );
        // eslint-disable-next-line no-await-in-loop
        await finishOne(row, err);
      }
    }
  } catch (err) {
    console.error("Recompute drain loop error:", err);
  } finally {
    draining = false;
  }
}

async function nightlyPass() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recent = await MonitoringEvent.findAll({
      where: { received_at: { [Op.gte]: since } },
      attributes: ["agent_id", "local_date"],
      group: ["agent_id", "local_date"],
      raw: true,
    });

    const today = serverLocalDate(new Date());
    const provisional = await MonitoringPcSession.findAll({
      where: { is_provisional: true, local_date: { [Op.lt]: today } },
      attributes: ["agent_id", "local_date"],
      raw: true,
    });

    const byAgent = new Map();
    for (const r of [...recent, ...provisional]) {
      const key = r.agent_id;
      if (!byAgent.has(key)) byAgent.set(key, new Set());
      byAgent.get(key).add(
        typeof r.local_date === "string"
          ? r.local_date
          : serverLocalDate(r.local_date)
      );
    }

    for (const [agentId, dates] of byAgent.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await enqueueRecompute({ agentId, localDates: [...dates] });
    }

    if (byAgent.size > 0) {
      console.log(
        `Monitoring nightly pass: enqueued recompute for ${byAgent.size} agent(s).`
      );
    }
  } catch (err) {
    console.error("Monitoring nightly pass error:", err);
  }
}

function start() {
  if (started) return;
  if (!isEnabled()) {
    console.log(
      "Monitoring recompute runner DISABLED by MONITORING_RECOMPUTE_RUNNER_ENABLED=false."
    );
    return;
  }
  started = true;

  drainTimer = setInterval(() => {
    drainOnce().catch((e) => console.error("drainOnce:", e));
  }, DRAIN_INTERVAL_MS);
  if (drainTimer.unref) drainTimer.unref();

  nightlyTimer = setInterval(() => {
    nightlyPass().catch((e) => console.error("nightlyPass:", e));
  }, NIGHTLY_INTERVAL_MS);
  if (nightlyTimer.unref) nightlyTimer.unref();

  // Kick both shortly after boot so a restart doesn't wait a full interval.
  setTimeout(() => drainOnce().catch(() => {}), 5 * 1000).unref?.();
  setTimeout(() => nightlyPass().catch(() => {}), 30 * 1000).unref?.();

  console.log(
    `Monitoring recompute runner started (drain ${DRAIN_INTERVAL_MS / 1000}s, nightly ${
      NIGHTLY_INTERVAL_MS / 3600000
    }h). Also drains opportunistically on event ingest.`
  );
}

function stop() {
  if (drainTimer) clearInterval(drainTimer);
  if (nightlyTimer) clearInterval(nightlyTimer);
  drainTimer = null;
  nightlyTimer = null;
  started = false;
}

/**
 * Opportunistic drain, called from the event-ingest request path. This is the
 * primary derivation trigger in environments where the host suspends idle
 * background timers (Passenger / shared hosting): every batch of events that
 * reaches the server also nudges the queue forward. Fire-and-forget — never
 * throws, never blocks the caller, and `drainOnce`'s own guard prevents
 * overlap.
 */
function kick() {
  if (!isEnabled()) return;
  Promise.resolve()
    .then(() => drainOnce())
    .catch((e) => console.error("recompute kick:", e));
}

/** Snapshot for the manual-trigger endpoint / diagnostics. */
function status() {
  return {
    enabled: isEnabled(),
    started,
    draining,
    drain_interval_ms: DRAIN_INTERVAL_MS,
    nightly_interval_ms: NIGHTLY_INTERVAL_MS,
  };
}

module.exports = { start, stop, drainOnce, nightlyPass, claimOne, kick, status };
