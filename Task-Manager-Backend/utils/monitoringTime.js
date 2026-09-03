"use strict";

/**
 * Time helpers for the monitoring events pipeline.
 *
 * Day boundary (Decision 5): the server's LOCAL date. There is no per-employee
 * timezone handling and the existing/default behaviour is not changed. If the
 * server process runs in UTC, these are effectively UTC dates — consistently so.
 */

// Milliseconds of wall-clock disagreement we tolerate between an event's
// agent-reported occurred_at and the server's receipt time before flagging it.
// Deliberately generous for Phase 1; can be tightened later.
const DEFAULT_CLOCK_SKEW_BUDGET_MS = 5 * 60 * 1000;

/**
 * "YYYY-MM-DD" for the given instant in the server's local timezone.
 * @param {Date|number|string} value
 * @returns {string}
 */
function serverLocalDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`serverLocalDate: unparseable date ${value}`);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * True when occurred_at is implausibly far from received_at (clock tamper /
 * badly wrong client clock). Duration math still trusts monotonic_ms; only the
 * displayed wall time is later clamped for suspect events.
 *
 * @param {Date|number} occurredAt
 * @param {Date|number} receivedAt
 * @param {number} [budgetMs]
 * @returns {boolean}
 */
function isClockSuspect(occurredAt, receivedAt, budgetMs = DEFAULT_CLOCK_SKEW_BUDGET_MS) {
  const o = occurredAt instanceof Date ? occurredAt.getTime() : Number(occurredAt);
  const r = receivedAt instanceof Date ? receivedAt.getTime() : Number(receivedAt);
  if (!Number.isFinite(o) || !Number.isFinite(r)) return true;
  return Math.abs(o - r) > budgetMs;
}

module.exports = {
  DEFAULT_CLOCK_SKEW_BUDGET_MS,
  serverLocalDate,
  isClockSuspect,
};
