"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { reduceInputState } = require("../src/monitoring/inputState");

const T = 300; // threshold seconds
const now = new Date("2026-09-03T12:00:00.000Z");

test("active -> idle once the threshold is crossed, boundary back-dated", () => {
  const r = reduceInputState({ state: "active" }, 400, now, T);
  assert.equal(r.state, "idle");
  assert.equal(r.changed, true);
  // 400s before `now`
  assert.equal(r.boundary.toISOString(), "2026-09-03T11:53:20.000Z");
});

test("stays active below the threshold", () => {
  const r = reduceInputState({ state: "active" }, 120, now, T);
  assert.equal(r.state, "active");
  assert.equal(r.changed, false);
  assert.equal(r.boundary, null);
});

test("stays idle while still above the threshold (no per-poll churn)", () => {
  const r = reduceInputState({ state: "idle" }, 900, now, T);
  assert.equal(r.changed, false);
});

test("idle -> active on any input, boundary = now", () => {
  const r = reduceInputState({ state: "idle" }, 3, now, T);
  assert.equal(r.state, "active");
  assert.equal(r.changed, true);
  assert.equal(r.boundary.toISOString(), now.toISOString());
});

test("exactly at threshold counts as idle", () => {
  const r = reduceInputState({ state: "active" }, 300, now, T);
  assert.equal(r.state, "idle");
});

test("non-finite / negative idle seconds hold state", () => {
  assert.equal(reduceInputState({ state: "active" }, NaN, now, T).changed, false);
  assert.equal(reduceInputState({ state: "idle" }, -1, now, T).changed, false);
});
