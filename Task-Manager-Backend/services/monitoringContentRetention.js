"use strict";

/**
 * §5b-4 content retention job.
 *
 * Once a day (and ~1 min after boot) it hard-deletes every monitoring_content_events
 * row whose expires_at is in the past. expires_at was fixed at insert time to
 * captured_at + org.content_retention_days (clamped 30–90), so this job needs no
 * per-org logic — it just deletes what is already expired.
 *
 * Inert in practice until Phase 4 (no rows exist while the legal gate is
 * closed), but always running so retention is never something to "remember to
 * turn on".
 */

const { MonitoringContentEvent } = require("../models");
const { sweepExpiredContent } = require("./monitoringContent");

const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS =
  Number(process.env.MONITORING_CONTENT_RETENTION_INTERVAL_MS) > 0
    ? Number(process.env.MONITORING_CONTENT_RETENTION_INTERVAL_MS)
    : DAY_MS;

let timer = null;
let started = false;

async function runOnce() {
  try {
    const deleted = await sweepExpiredContent({
      destroy: (where) => MonitoringContentEvent.destroy({ where }),
      now: new Date(),
    });
    if (deleted > 0) {
      console.log(`Monitoring content retention: hard-deleted ${deleted} expired row(s).`);
    }
    return deleted;
  } catch (err) {
    console.error("Monitoring content retention error:", err);
    return 0;
  }
}

function start() {
  if (started) return;
  if (String(process.env.MONITORING_CONTENT_RETENTION_ENABLED || "true") === "false") {
    console.log("Monitoring content retention disabled by env.");
    return;
  }
  started = true;
  timer = setInterval(() => {
    runOnce().catch((e) => console.error("content retention tick:", e));
  }, INTERVAL_MS);
  if (timer.unref) timer.unref();

  setTimeout(() => runOnce().catch(() => {}), 60 * 1000).unref?.();

  console.log(
    `Monitoring content retention started (every ${(INTERVAL_MS / 3600000).toFixed(1)}h).`
  );
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

module.exports = { start, stop, runOnce };
