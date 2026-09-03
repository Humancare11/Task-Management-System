"use strict";

// Screen reducer: folds display power + powerMonitor lock/suspend into one
// on/off state + reason set, and emits a transition on every real change
// (including a reason-set shift while the screen stays off — §2a).

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ScreenReducer,
  primaryReason,
  REASON_PRECEDENCE,
} = require("../src/monitoring/screenReducer");

test("primaryReason precedence: reboot > sleep > locked > display_off", () => {
  assert.equal(primaryReason(["display_off", "locked"]), "locked");
  assert.equal(primaryReason(["locked", "sleep"]), "sleep");
  assert.equal(primaryReason(["display_off", "sleep", "reboot"]), "reboot");
  assert.equal(primaryReason(["display_off"]), "display_off");
  assert.equal(primaryReason([]), null);
  // identical order to the backend derivation engine
  assert.deepEqual(REASON_PRECEDENCE, ["reboot", "sleep", "locked", "display_off"]);
});

test("display off then on -> one off transition, one on transition", () => {
  const r = new ScreenReducer();
  assert.equal(r.applyDisplay(false), null); // no change
  const off = r.applyDisplay(true);
  assert.deepEqual(off, { state: "off", reason: "display_off", reasons: ["display_off"] });
  assert.equal(r.applyDisplay(true), null); // still off, same reason -> no churn
  const on = r.applyDisplay(false);
  assert.deepEqual(on, { state: "on", reason: null, reasons: [] });
});

test("§2a: lock on top of an already-off display -> reason-set-change transition", () => {
  const r = new ScreenReducer();
  assert.deepEqual(r.applyDisplay(true), {
    state: "off",
    reason: "display_off",
    reasons: ["display_off"],
  });
  // user locks while the display is already off
  const locked = r.applyPower({ locked: true });
  assert.equal(locked.state, "off");
  assert.equal(locked.reason, "locked"); // locked outranks display_off
  assert.deepEqual(locked.reasons.slice().sort(), ["display_off", "locked"]);
  // unlock: display still off -> back to [display_off]
  const unlocked = r.applyPower({ locked: false });
  assert.deepEqual(unlocked, {
    state: "off",
    reason: "display_off",
    reasons: ["display_off"],
  });
});

test("lock while display on -> off/locked; unlock -> on", () => {
  const r = new ScreenReducer();
  const locked = r.applyPower({ locked: true });
  assert.deepEqual(locked, { state: "off", reason: "locked", reasons: ["locked"] });
  assert.equal(r.applyPower({ locked: true }), null); // idempotent
  const unlocked = r.applyPower({ locked: false });
  assert.deepEqual(unlocked, { state: "on", reason: null, reasons: [] });
});

test("suspend outranks a concurrent lock + display-off", () => {
  const r = new ScreenReducer();
  r.applyDisplay(true);
  r.applyPower({ locked: true });
  const suspended = r.applyPower({ suspended: true });
  assert.equal(suspended.reason, "sleep");
  assert.deepEqual(suspended.reasons.slice().sort(), ["display_off", "locked", "sleep"]);
  // resume from sleep, display comes back and unlock -> fully on
  assert.equal(r.applyPower({ suspended: false }).reason, "locked");
  r.applyPower({ locked: false });
  assert.deepEqual(r.applyDisplay(false), { state: "on", reason: null, reasons: [] });
});

test("stays off across display->lock handoff without a spurious 'on'", () => {
  const r = new ScreenReducer();
  r.applyPower({ locked: true }); // off/locked
  // display powers off a moment later, still locked
  const t = r.applyDisplay(true);
  assert.equal(t.state, "off");
  assert.deepEqual(t.reasons.slice().sort(), ["display_off", "locked"]);
  // unlock but display still off -> NEVER emits state:"on"
  const afterUnlock = r.applyPower({ locked: false });
  assert.equal(afterUnlock.state, "off");
  assert.deepEqual(afterUnlock.reasons, ["display_off"]);
});

test("initial state 'off' starts with a display_off reason set", () => {
  const r = new ScreenReducer("off");
  assert.equal(r.getState(), "off");
  assert.deepEqual(r.getReasons(), ["display_off"]);
  assert.deepEqual(r.applyDisplay(false), { state: "on", reason: null, reasons: [] });
});

test("unrelated power patch fields are ignored", () => {
  const r = new ScreenReducer();
  assert.equal(r.applyPower({}), null);
  assert.equal(r.applyPower({ locked: "yes" }), null); // non-boolean ignored
  assert.equal(r.getState(), "on");
});
