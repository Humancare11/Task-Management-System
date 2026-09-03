"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { serverLocalDate, isClockSuspect } = require("../utils/monitoringTime");

test("serverLocalDate formats YYYY-MM-DD in server local time", () => {
  const d = new Date(2026, 8, 3, 23, 30, 0); // 2026-09-03 local
  assert.equal(serverLocalDate(d), "2026-09-03");
  assert.equal(serverLocalDate(new Date(2026, 0, 5, 0, 0, 0)), "2026-01-05");
});

test("serverLocalDate accepts strings and numbers", () => {
  const ms = new Date(2026, 8, 3, 12).getTime();
  assert.equal(serverLocalDate(ms), "2026-09-03");
});

test("serverLocalDate rejects garbage", () => {
  assert.throws(() => serverLocalDate("not-a-date"));
});

test("isClockSuspect flags large skew, allows small", () => {
  const now = Date.now();
  assert.equal(isClockSuspect(now - 10_000, now), false); // 10s
  assert.equal(isClockSuspect(now - 10 * 60_000, now), true); // 10min
  assert.equal(isClockSuspect(now + 10 * 60_000, now), true); // future
  assert.equal(isClockSuspect(NaN, now), true);
});

test("isClockSuspect respects a custom budget", () => {
  const now = Date.now();
  assert.equal(isClockSuspect(now - 30_000, now, 10_000), true);
  assert.equal(isClockSuspect(now - 5_000, now, 10_000), false);
});
