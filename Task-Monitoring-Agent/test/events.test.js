"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { makeEnvelope, RUN_ID, getOsBootTime } = require("../src/monitoring/events");

test("makeEnvelope produces a complete envelope", () => {
  const e = makeEnvelope({ type: "app_focus", payload: { application_name: "Code" }, seq: 42 });
  assert.equal(e.type, "app_focus");
  assert.equal(e.client_seq, 42);
  assert.equal(e.run_id, RUN_ID);
  assert.equal(typeof e.client_event_id, "string");
  assert.equal(e.client_event_id.length, 36);
  assert.equal(typeof e.monotonic_ms, "number");
  assert.ok(Number.isFinite(e.os_boot_time));
  assert.ok(!Number.isNaN(Date.parse(e.occurred_at)));
  assert.deepEqual(e.payload, { application_name: "Code" });
});

test("client_event_id is unique per call", () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i += 1) {
    ids.add(makeEnvelope({ type: "heartbeat", seq: i }).client_event_id);
  }
  assert.equal(ids.size, 1000);
});

test("unknown event types are rejected", () => {
  assert.throws(() => makeEnvelope({ type: "totally_made_up" }), /unknown event type/);
  assert.throws(() => makeEnvelope({}), /`type` is required/);
});

test("occurredAt override is honoured", () => {
  const when = "2026-09-03T10:00:00.000Z";
  assert.equal(makeEnvelope({ type: "heartbeat", occurredAt: when }).occurred_at, when);
  assert.equal(
    makeEnvelope({ type: "heartbeat", occurredAt: new Date(when) }).occurred_at,
    when
  );
});

test("getOsBootTime is a plausible past timestamp", () => {
  const boot = getOsBootTime();
  assert.ok(boot > 0);
  assert.ok(boot <= Date.now());
});
