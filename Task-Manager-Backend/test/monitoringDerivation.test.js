"use strict";

/**
 * Fixture-based tests for the derivation engine — every §9 scenario, plus the
 * 4-way per-device invariant on every fixture and the cross-device union merge.
 *
 * Times are "HH:MM" minutes into a fixed local day. Real agents heartbeat every
 * 30s; fixtures use a 2-minute filler (hb()) which is well under the
 * SAME_RUN_GAP_UNTRACKED_MS threshold, so a normal working stretch never
 * produces a spurious "untracked" gap.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  deriveDayFromEvents,
  mergeDeviceDays,
  parseLocalDate,
  pickPrimaryReason,
} = require("../services/monitoringDerivation");

const DAY = "2026-09-03";
const { dayStart, dayEnd } = parseLocalDate(DAY);

const RUN = "run-A";
const BOOT = 1_700_000_000_000;
let seq = 0;

const M = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const tAt = (hhmm) => new Date(dayStart.getTime() + M(hhmm) * 60000);

function ev(type, hhmm, payload = {}, extra = {}) {
  seq += 1;
  return {
    type,
    occurred_at: tAt(hhmm),
    payload,
    run_id: extra.run || RUN,
    os_boot_time: extra.boot === undefined ? BOOT : extra.boot,
    client_seq: seq,
  };
}

function hb(fromHHMM, toHHMM, extra = {}) {
  const out = [];
  for (let t = M(fromHHMM); t <= M(toHHMM); t += 2) {
    seq += 1;
    out.push({
      type: "heartbeat",
      occurred_at: new Date(dayStart.getTime() + t * 60000),
      payload: {},
      run_id: extra.run || RUN,
      os_boot_time: extra.boot === undefined ? BOOT : extra.boot,
      client_seq: seq,
    });
  }
  return out;
}

function derive(dayEvents, opts = {}) {
  return deriveDayFromEvents({
    dayEvents,
    prior: opts.prior || {},
    dayStart,
    dayEnd,
    now: opts.now || dayEnd,
    isToday: opts.isToday || false,
    hasNextDayContinuation: opts.hasNextDayContinuation || false,
  });
}

// The 4-way invariant, asserted on every fixture.
function assertInvariant(pc, label) {
  const sum =
    pc.active_seconds + pc.idle_seconds + pc.screen_off_seconds + pc.untracked_seconds;
  assert.equal(
    pc.reconciliation_delta_seconds,
    pc.total_seconds - sum,
    `${label}: reconciliation_delta must equal total - sum`
  );
  assert.ok(
    Math.abs(pc.reconciliation_delta_seconds) <= 3,
    `${label}: 4-way invariant within rounding (delta=${pc.reconciliation_delta_seconds})`
  );
}

const secondsOfType = (intervals, type) =>
  intervals.filter((i) => i.type === type).reduce((s, i) => s + i.duration_seconds, 0);

// ---------------------------------------------------------------------------

test("§9: app switch + website change — sessions split correctly, all active", () => {
  seq = 0;
  const events = [
    ev("agent_start", "09:00"),
    ev("app_focus", "09:00", { application_name: "Visual Studio Code" }),
    ev("input_state", "09:00", { state: "active" }),
    ...hb("09:00", "17:00"),
    ev("app_focus", "10:30", { application_name: "Google Chrome" }),
    ev("browser_state", "10:30", { browser: "chrome", domain: "github.com", is_private: false }),
    ev("browser_state", "11:00", { browser: "chrome", domain: "youtube.com", is_private: false }),
    ev("app_focus", "12:00", { application_name: "Visual Studio Code" }),
    ev("agent_stop", "17:00", { reason: "tray_exit" }),
  ];
  const d = derive(events);

  assert.equal(d.pcSession.total_seconds, 8 * 3600);
  assert.equal(d.pcSession.active_seconds, 8 * 3600);
  assert.equal(d.pcSession.unclean_shutdown, false);
  assert.equal(d.pcSession.is_provisional, false);
  assertInvariant(d.pcSession, "app-switch");

  // Code before Chrome (90m) + Code after Chrome (300m); Chrome (90m).
  const codeSecs = d.appSessions
    .filter((a) => a.application_name === "Visual Studio Code")
    .reduce((s, a) => s + a.duration_seconds, 0);
  const chromeSecs = d.appSessions
    .filter((a) => a.application_name === "Google Chrome")
    .reduce((s, a) => s + a.duration_seconds, 0);
  assert.equal(codeSecs, (90 + 300) * 60);
  assert.equal(chromeSecs, 90 * 60);

  // website change -> two web sessions, only while Chrome is focused (10:30-12:00)
  const gh = d.webSessions.find((w) => w.domain === "github.com");
  const yt = d.webSessions.find((w) => w.domain === "youtube.com");
  assert.equal(gh.duration_seconds, 30 * 60);
  assert.equal(yt.duration_seconds, 60 * 60);
  assert.equal(d.webSessions.reduce((s, w) => s + w.duration_seconds, 0), 90 * 60);
});

test("§9: going idle then becoming active — idle back-dated, not carved from app time", () => {
  seq = 0;
  const events = [
    ev("agent_start", "09:00"),
    ev("app_focus", "09:00", { application_name: "Code" }),
    ev("input_state", "09:00", { state: "active" }),
    ...hb("09:00", "12:00"),
    ev("input_state", "10:00", {
      state: "idle",
      last_input_at: tAt("09:55").toISOString(),
    }),
    ev("input_state", "11:30", { state: "active", last_input_at: tAt("11:30").toISOString() }),
    ev("agent_stop", "12:00"),
  ];
  const d = derive(events);

  assert.equal(d.pcSession.total_seconds, 3 * 3600);
  assert.equal(d.pcSession.idle_seconds, 95 * 60); // 09:55 -> 11:30
  assert.equal(d.pcSession.active_seconds, 3 * 3600 - 95 * 60);
  assert.equal(d.pcSession.idle_period_count, 1);
  assert.equal(d.pcSession.screen_off_seconds, 0);
  assertInvariant(d.pcSession, "idle");

  // app session spans the whole session; idle is NOT carved out, only reflected
  // in active_seconds.
  const code = d.appSessions.find((a) => a.application_name === "Code");
  assert.equal(code.duration_seconds, 3 * 3600);
  assert.equal(code.active_seconds, 3 * 3600 - 95 * 60);
});

test("§9: screen off / on multiple times in one day — ONE session, periods counted", () => {
  seq = 0;
  const events = [
    ev("agent_start", "09:00"),
    ev("app_focus", "09:00", { application_name: "Code" }),
    ev("input_state", "09:00", { state: "active" }),
    ...hb("09:00", "18:00"),
    ev("screen_state", "12:00", { state: "off", reason: "display_off" }),
    ev("screen_state", "12:30", { state: "on" }),
    ev("screen_state", "15:00", { state: "off", reason: "display_off" }),
    ev("screen_state", "15:20", { state: "on" }),
    ev("agent_stop", "18:00"),
  ];
  const d = derive(events);

  assert.equal(d.pcSession.total_seconds, 9 * 3600);
  assert.equal(d.pcSession.screen_off_seconds, (30 + 20) * 60);
  assert.equal(d.pcSession.active_seconds, 9 * 3600 - (30 + 20) * 60);
  assert.equal(d.pcSession.screen_off_period_count, 2);
  assert.equal(d.pcSession.idle_seconds, 0);
  assert.equal(d.pcSession.untracked_seconds, 0);
  assertInvariant(d.pcSession, "screen-off");

  // exactly one PC session; the timeline alternates active / screen_off
  assert.deepEqual(
    d.intervals.map((i) => i.type),
    ["active", "screen_off", "active", "screen_off", "active"]
  );
  assert.ok(d.intervals.filter((i) => i.type === "screen_off").every((i) => i.screen_off_reason === "display_off"));

  // app session carved out of screen_off -> 3 pieces
  const code = d.appSessions.filter((a) => a.application_name === "Code");
  assert.equal(code.length, 3);
  assert.equal(code.reduce((s, a) => s + a.duration_seconds, 0), 9 * 3600 - (30 + 20) * 60);
});

test("§9: screen off from before midnight (entry state) is honoured", () => {
  seq = 0;
  const events = [
    ...hb("00:00", "03:00"),
    ev("screen_state", "01:00", { state: "on" }),
    ev("agent_stop", "03:00"),
  ];
  const d = derive(events, {
    prior: {
      lifecycle: { occurred_at: tAt("00:00"), run_id: RUN, os_boot_time: BOOT },
      mostRecent: { occurred_at: tAt("00:00"), run_id: RUN, os_boot_time: BOOT },
      screen_state: { payload: { state: "off", reason: "locked" } },
      input_state: { payload: { state: "active" } },
      app_focus: { payload: { application_name: "Code" } },
    },
  });

  // session spans from dayStart (00:00) to 03:00
  assert.equal(d.pcSession.first_pc_on.getTime(), dayStart.getTime());
  assert.equal(d.pcSession.total_seconds, 3 * 3600);
  // screen was off 00:00 -> 01:00, reason carried from entry state
  assert.equal(d.pcSession.screen_off_seconds, 3600);
  assert.equal(d.intervals[0].type, "screen_off");
  assert.equal(d.intervals[0].screen_off_reason, "locked");
  assertInvariant(d.pcSession, "entry-screen-off");
});

test("§9: clean final shutdown (session_end) ends the session at that instant", () => {
  seq = 0;
  const events = [
    ev("agent_start", "08:00"),
    ev("input_state", "08:00", { state: "active" }),
    ...hb("08:00", "17:30"),
    ev("session_end", "17:30", { signal: "windows_session_end" }),
  ];
  const d = derive(events);
  assert.equal(d.pcSession.final_pc_off.getTime(), tAt("17:30").getTime());
  assert.equal(d.pcSession.unclean_shutdown, false);
  assert.equal(d.pcSession.is_provisional, false);
  assert.equal(d.pcSession.total_seconds, 9.5 * 3600);
  assertInvariant(d.pcSession, "clean-shutdown");
});

test("§9: unclean shutdown — no stop event, not today -> flag set, ends at last heartbeat", () => {
  seq = 0;
  const events = [
    ev("agent_start", "09:00"),
    ev("input_state", "09:00", { state: "active" }),
    ...hb("09:00", "14:00"),
  ];
  const d = derive(events, { isToday: false, now: dayEnd });
  assert.equal(d.pcSession.unclean_shutdown, true);
  assert.equal(d.pcSession.is_provisional, false);
  assert.equal(d.pcSession.final_pc_off.getTime(), tAt("14:00").getTime());
  assert.equal(d.pcSession.total_seconds, 5 * 3600);
  assertInvariant(d.pcSession, "unclean-shutdown");
});

test("provisional — still today, fresh heartbeat -> provisional, not unclean", () => {
  seq = 0;
  const now = tAt("14:01"); // 1 min after last heartbeat
  const events = [
    ev("agent_start", "09:00"),
    ev("input_state", "09:00", { state: "active" }),
    ...hb("09:00", "14:00"),
  ];
  const d = derive(events, { isToday: true, now });
  assert.equal(d.pcSession.is_provisional, true);
  assert.equal(d.pcSession.unclean_shutdown, false);
  assertInvariant(d.pcSession, "provisional");
});

test("§9: agent restart mid-day (same OS boot) -> untracked gap, one session", () => {
  seq = 0;
  const events = [
    ev("agent_start", "09:00", {}, { run: "run-A" }),
    ev("app_focus", "09:00", { application_name: "Code" }, { run: "run-A" }),
    ev("input_state", "09:00", { state: "active" }, { run: "run-A" }),
    ...hb("09:00", "11:00", { run: "run-A" }),
    // ~45 min gap, then a fresh run, SAME os_boot_time
    ev("agent_start", "11:45", {}, { run: "run-B" }),
    ev("app_focus", "11:45", { application_name: "Code" }, { run: "run-B" }),
    ev("input_state", "11:45", { state: "active" }, { run: "run-B" }),
    ...hb("11:45", "15:00", { run: "run-B" }),
    ev("agent_stop", "15:00", {}, { run: "run-B" }),
  ];
  const d = derive(events);

  assert.equal(d.pcSession.total_seconds, 6 * 3600);
  assert.equal(d.pcSession.untracked_seconds, 45 * 60);
  assert.equal(d.pcSession.screen_off_seconds, 0);
  assert.equal(d.pcSession.active_seconds, 6 * 3600 - 45 * 60);
  assertInvariant(d.pcSession, "agent-restart");

  const u = d.intervals.filter((i) => i.type === "untracked");
  assert.equal(u.length, 1);
  assert.equal(u[0].duration_seconds, 45 * 60);

  // app + web sessions are carved out of the untracked gap
  const code = d.appSessions.filter((a) => a.application_name === "Code");
  assert.equal(code.reduce((s, a) => s + a.duration_seconds, 0), 6 * 3600 - 45 * 60);
});

test("§9: reboot mid-day (os_boot_time changes) -> screen_off/reboot, one session", () => {
  seq = 0;
  const bootBefore = BOOT;
  const bootAfter = BOOT + 3 * 3600 * 1000; // machine came back up 3h "later" in boot-clock terms
  const events = [
    ev("agent_start", "09:00", {}, { run: "run-A", boot: bootBefore }),
    ev("input_state", "09:00", { state: "active" }, { run: "run-A", boot: bootBefore }),
    ...hb("09:00", "13:00", { run: "run-A", boot: bootBefore }),
    // reboot: ~10 min gap, new run AND new os_boot_time
    ev("agent_start", "13:10", {}, { run: "run-B", boot: bootAfter }),
    ev("input_state", "13:10", { state: "active" }, { run: "run-B", boot: bootAfter }),
    ...hb("13:10", "18:00", { run: "run-B", boot: bootAfter }),
    ev("agent_stop", "18:00", {}, { run: "run-B", boot: bootAfter }),
  ];
  const d = derive(events);

  assert.equal(d.pcSession.total_seconds, 9 * 3600); // ONE session 09:00 -> 18:00
  assert.equal(d.pcSession.screen_off_seconds, 10 * 60);
  assert.equal(d.pcSession.untracked_seconds, 0);
  assertInvariant(d.pcSession, "reboot");

  const reboot = d.intervals.filter((i) => i.type === "screen_off" && i.screen_off_reason === "reboot");
  assert.equal(reboot.length, 1);
  assert.equal(reboot[0].duration_seconds, 10 * 60);
});

test("§9: sleep-shaped gap in Phase 1 (same run, long gap, no powerMonitor) -> untracked", () => {
  seq = 0;
  const events = [
    ev("agent_start", "09:00"),
    ev("input_state", "09:00", { state: "active" }),
    ...hb("09:00", "12:00"),
    // lid closed 12:00 -> 15:00; process frozen, SAME run, no screen_state event
    ...hb("15:00", "17:00"),
    ev("agent_stop", "17:00"),
  ];
  const d = derive(events);
  assert.equal(d.pcSession.total_seconds, 8 * 3600);
  assert.equal(d.pcSession.untracked_seconds, 3 * 3600); // 12:00 -> 15:00
  assertInvariant(d.pcSession, "sleep-as-untracked");
});

test("§9: data-accuracy sweep — app switch, website, idle, active, screen off/on, resume", () => {
  seq = 0;
  const events = [
    ev("agent_start", "08:30"),
    ev("app_focus", "08:30", { application_name: "Visual Studio Code" }),
    ev("input_state", "08:30", { state: "active" }),
    ...hb("08:30", "18:00"),
    ev("app_focus", "10:00", { application_name: "Google Chrome" }),
    ev("browser_state", "10:00", { browser: "chrome", domain: "docs.google.com" }),
    ev("browser_state", "10:40", { browser: "chrome", domain: "stackoverflow.com" }),
    ev("input_state", "11:00", { state: "idle", last_input_at: tAt("10:55").toISOString() }),
    ev("input_state", "11:20", { state: "active" }),
    ev("app_focus", "11:20", { application_name: "Visual Studio Code" }),
    ev("screen_state", "13:00", { state: "off", reason: "display_off" }),
    ev("screen_state", "13:45", { state: "on" }),
    ev("app_focus", "13:45", { application_name: "Slack" }),
    ev("app_focus", "14:00", { application_name: "Visual Studio Code" }),
    ev("agent_stop", "18:00"),
  ];
  const d = derive(events);

  const total = 9.5 * 3600;
  assert.equal(d.pcSession.total_seconds, total);
  assert.equal(d.pcSession.screen_off_seconds, 45 * 60);
  assert.equal(d.pcSession.idle_seconds, 25 * 60); // 10:55 -> 11:20
  assert.equal(
    d.pcSession.active_seconds,
    total - 45 * 60 - 25 * 60
  );
  assert.equal(d.pcSession.untracked_seconds, 0);
  assertInvariant(d.pcSession, "sweep");

  // timeline covers the whole session with no gaps/overlaps
  let cursor = d.pcSession.first_pc_on.getTime();
  for (const i of d.intervals) {
    assert.equal(i.started_at.getTime(), cursor);
    cursor = i.ended_at.getTime();
  }
  assert.equal(cursor, d.pcSession.final_pc_off.getTime());
});

test("midnight split — a session running past midnight ends exactly at dayEnd", () => {
  seq = 0;
  const events = [
    ev("agent_start", "22:00"),
    ev("input_state", "22:00", { state: "active" }),
    ...hb("22:00", "23:58"),
  ];
  const d = derive(events, { hasNextDayContinuation: true });
  assert.equal(d.pcSession.final_pc_off.getTime(), dayEnd.getTime());
  assert.equal(d.pcSession.unclean_shutdown, false);
  assert.equal(d.pcSession.is_provisional, false);
  assert.equal(d.pcSession.total_seconds, 2 * 3600);
  assertInvariant(d.pcSession, "midnight-split");
});

test("no events -> null (no PC session for the day)", () => {
  seq = 0;
  assert.equal(derive([]), null);
});

// ---------------------------------------------------------------------------
// Phase 3: powerMonitor reason precedence + reboot/agent-restart stitching
// ---------------------------------------------------------------------------

test("pickPrimaryReason precedence: reboot > sleep > locked > display_off", () => {
  assert.equal(pickPrimaryReason(["display_off", "locked"]), "locked");
  assert.equal(pickPrimaryReason(["locked", "sleep"]), "sleep");
  assert.equal(pickPrimaryReason(["display_off", "sleep", "reboot"]), "reboot");
  assert.equal(pickPrimaryReason(["display_off"]), "display_off");
  assert.equal(pickPrimaryReason([]), "display_off");
});

test("§2a: lock on top of display-off -> reason set merged, split sub-intervals", () => {
  seq = 0;
  const events = [
    ev("agent_start", "09:00"),
    ev("input_state", "09:00", { state: "active" }),
    ...hb("09:00", "18:00"),
    ev("screen_state", "12:00", { state: "off", reason: "display_off", reasons: ["display_off"] }),
    // user locks the machine while the display is already off
    ev("screen_state", "12:10", { state: "off", reason: "locked", reasons: ["locked", "display_off"] }),
    // unlock: display still off
    ev("screen_state", "12:40", { state: "off", reason: "display_off", reasons: ["display_off"] }),
    ev("screen_state", "13:00", { state: "on" }),
    ev("agent_stop", "18:00"),
  ];
  const d = derive(events);

  assert.equal(d.pcSession.screen_off_seconds, 60 * 60); // 12:00 -> 13:00
  assert.equal(d.pcSession.screen_off_period_count, 1); // one continuous screen-off period
  assertInvariant(d.pcSession, "lock-over-display-off");

  const so = d.intervals.filter((i) => i.type === "screen_off");
  // three sub-intervals as the reason set changes
  assert.equal(so.length, 3);
  assert.deepEqual(so.map((i) => i.screen_off_reason), ["display_off", "locked", "display_off"]);
  const locked = so.find((i) => i.screen_off_reason === "locked");
  assert.deepEqual(locked.reasons.sort(), ["display_off", "locked"]);
  assert.equal(locked.duration_seconds, 30 * 60); // 12:10 -> 12:40
});

test("§9: sleep (powerMonitor suspend) -> screen_off/sleep, not untracked", () => {
  seq = 0;
  const events = [
    ev("agent_start", "09:00"),
    ev("input_state", "09:00", { state: "active" }),
    ...hb("09:00", "12:00"),
    ev("screen_state", "12:00", { state: "off", reason: "sleep", reasons: ["sleep"] }),
    // no heartbeats while suspended
    ev("screen_state", "15:00", { state: "on" }),
    ...hb("15:00", "17:00"),
    ev("agent_stop", "17:00"),
  ];
  const d = derive(events);
  assert.equal(d.pcSession.screen_off_seconds, 3 * 3600); // 12:00 -> 15:00
  assert.equal(d.pcSession.untracked_seconds, 0); // NOT untracked — sleep was reported
  const sleep = d.intervals.filter((i) => i.type === "screen_off" && i.screen_off_reason === "sleep");
  assert.equal(sleep.length, 1);
  assert.equal(sleep[0].duration_seconds, 3 * 3600);
  assertInvariant(d.pcSession, "sleep-reported");
});

test("stitching: two runs of the SAME boot never produce a reboot gap", () => {
  seq = 0;
  // os_boot_time fixed per run (agent's events.js), but the two runs computed it
  // ~2s apart -> a small delta that must NOT read as a reboot.
  const bootA = 1_700_000_000_000;
  const bootB = bootA + 2000; // 2s jitter
  const events = [
    ev("agent_start", "09:00", {}, { run: "run-A", boot: bootA }),
    ev("input_state", "09:00", { state: "active" }, { run: "run-A", boot: bootA }),
    ...hb("09:00", "11:00", { run: "run-A", boot: bootA }),
    ev("agent_start", "11:30", {}, { run: "run-B", boot: bootB }),
    ev("input_state", "11:30", { state: "active" }, { run: "run-B", boot: bootB }),
    ...hb("11:30", "15:00", { run: "run-B", boot: bootB }),
    ev("agent_stop", "15:00", {}, { run: "run-B", boot: bootB }),
  ];
  const d = derive(events);
  // the 11:00 -> 11:30 gap is an agent restart (untracked), NOT a reboot
  assert.equal(d.pcSession.screen_off_seconds, 0);
  assert.equal(d.pcSession.untracked_seconds, 30 * 60);
  assert.equal(
    d.intervals.filter((i) => i.type === "screen_off" && i.screen_off_reason === "reboot").length,
    0
  );
  assertInvariant(d.pcSession, "same-boot-jitter");
});

test("stitching: run change + os_boot_time delta JUST UNDER tolerance -> untracked, not reboot", () => {
  seq = 0;
  const bootA = 1_700_000_000_000;
  const bootB = bootA + (5 * 60 * 1000 - 1000); // 4m59s — under REBOOT_OS_DELTA_MS
  const events = [
    ev("agent_start", "09:00", {}, { run: "run-A", boot: bootA }),
    ev("input_state", "09:00", { state: "active" }, { run: "run-A", boot: bootA }),
    ...hb("09:00", "11:00", { run: "run-A", boot: bootA }),
    ev("agent_start", "11:20", {}, { run: "run-B", boot: bootB }),
    ...hb("11:20", "15:00", { run: "run-B", boot: bootB }),
    ev("agent_stop", "15:00", {}, { run: "run-B", boot: bootB }),
  ];
  const d = derive(events);
  assert.equal(d.pcSession.screen_off_seconds, 0);
  assert.equal(d.pcSession.untracked_seconds, 20 * 60);
  assert.equal(
    d.intervals.filter((i) => i.type === "screen_off" && i.screen_off_reason === "reboot").length,
    0
  );
  assertInvariant(d.pcSession, "under-tolerance");
});

test("stitching: run change + os_boot_time delta JUST OVER tolerance -> reboot", () => {
  seq = 0;
  const bootA = 1_700_000_000_000;
  const bootB = bootA + (5 * 60 * 1000 + 1000); // 5m01s — over REBOOT_OS_DELTA_MS
  const events = [
    ev("agent_start", "09:00", {}, { run: "run-A", boot: bootA }),
    ev("input_state", "09:00", { state: "active" }, { run: "run-A", boot: bootA }),
    ...hb("09:00", "11:00", { run: "run-A", boot: bootA }),
    ev("agent_start", "11:20", {}, { run: "run-B", boot: bootB }),
    ...hb("11:20", "15:00", { run: "run-B", boot: bootB }),
    ev("agent_stop", "15:00", {}, { run: "run-B", boot: bootB }),
  ];
  const d = derive(events);
  assert.equal(d.pcSession.untracked_seconds, 0);
  assert.equal(d.pcSession.screen_off_seconds, 20 * 60);
  const reboot = d.intervals.filter(
    (i) => i.type === "screen_off" && i.screen_off_reason === "reboot"
  );
  assert.equal(reboot.length, 1);
  assert.equal(reboot[0].duration_seconds, 20 * 60);
  assertInvariant(d.pcSession, "over-tolerance");
});

test("stitching: within a single run, a constant os_boot_time never yields a reboot", () => {
  seq = 0;
  const events = [
    ev("agent_start", "09:00"),
    ev("input_state", "09:00", { state: "active" }),
    ...hb("09:00", "17:00"),
    ev("agent_stop", "17:00"),
  ];
  const d = derive(events);
  assert.equal(d.pcSession.screen_off_seconds, 0);
  assert.equal(d.pcSession.untracked_seconds, 0);
  assert.equal(d.pcSession.active_seconds, 8 * 3600);
  assertInvariant(d.pcSession, "single-run-no-reboot");
});

// ---------------------------------------------------------------------------
// cross-device union merge (§9: two devices same day)
// ---------------------------------------------------------------------------

function pc(id, onHHMM, offHHMM, extra = {}) {
  const total = (M(offHHMM) - M(onHHMM)) * 60;
  return {
    id,
    first_pc_on: tAt(onHHMM),
    final_pc_off: tAt(offHHMM),
    total_seconds: total,
    active_seconds: extra.active ?? total,
    idle_seconds: extra.idle ?? 0,
    screen_off_seconds: extra.screenOff ?? 0,
    untracked_seconds: extra.untracked ?? 0,
    unclean_shutdown: extra.unclean ?? false,
    is_provisional: extra.provisional ?? false,
  };
}
const seg = (pcId, type, aHHMM, bHHMM) => ({
  pc_session_id: pcId,
  type,
  started_at: tAt(aHHMM),
  ended_at: tAt(bHHMM),
});

function assertMergeInvariant(m, label) {
  const sum = m.active_seconds + m.idle_seconds + m.screen_off_seconds + m.untracked_seconds;
  assert.equal(m.reconciliation_delta_seconds, m.covered_seconds - sum, `${label}: delta`);
  assert.ok(Math.abs(m.reconciliation_delta_seconds) <= 3, `${label}: merged invariant (${m.reconciliation_delta_seconds})`);
  assert.equal(m.span_seconds, m.covered_seconds + m.gap_seconds, `${label}: span = covered + gap`);
}

test("§9: two devices, overlapping — covered = union, overlap_seconds = concurrent time", () => {
  const pcA = pc(1, "09:00", "13:00");
  const pcB = pc(2, "12:00", "18:00");
  const intervals = [seg(1, "active", "09:00", "13:00"), seg(2, "active", "12:00", "18:00")];
  const m = mergeDeviceDays({ pcSessions: [pcA, pcB], intervals });

  assert.equal(m.device_count, 2);
  assert.equal(m.multi_device, true);
  assert.equal(m.span_seconds, 9 * 3600); // 09:00 -> 18:00
  assert.equal(m.covered_seconds, 9 * 3600); // continuous union
  assert.equal(m.gap_seconds, 0);
  assert.equal(m.active_seconds, 9 * 3600);
  assert.equal(m.overlap_seconds, 3600); // 12:00 -> 13:00 on both
  assertMergeInvariant(m, "two-device-overlap");
});

test("§9: two devices with a gap between them — gap_seconds > 0, no overlap", () => {
  const pcA = pc(1, "09:00", "11:00");
  const pcB = pc(2, "14:00", "16:00");
  const intervals = [seg(1, "active", "09:00", "11:00"), seg(2, "active", "14:00", "16:00")];
  const m = mergeDeviceDays({ pcSessions: [pcA, pcB], intervals });

  assert.equal(m.span_seconds, 7 * 3600); // 09:00 -> 16:00
  assert.equal(m.covered_seconds, 4 * 3600); // 2h + 2h
  assert.equal(m.gap_seconds, 3 * 3600); // 11:00 -> 14:00 nothing on
  assert.equal(m.overlap_seconds, 0);
  assertMergeInvariant(m, "two-device-gap");
});

test("cross-device precedence active > idle at the same instant", () => {
  const pcA = pc(1, "10:00", "11:00", { active: 3600 });
  const pcB = pc(2, "10:00", "11:00", { active: 0, idle: 3600 });
  const intervals = [seg(1, "active", "10:00", "11:00"), seg(2, "idle", "10:00", "11:00")];
  const m = mergeDeviceDays({ pcSessions: [pcA, pcB], intervals });
  assert.equal(m.active_seconds, 3600);
  assert.equal(m.idle_seconds, 0);
  assert.equal(m.overlap_seconds, 3600);
  assertMergeInvariant(m, "cross-device-precedence");
});

test("single device merge collapses to the plain 4-way invariant", () => {
  const pcA = pc(1, "09:00", "17:00", { active: 8 * 3600 - 1800, idle: 1800 });
  const intervals = [
    seg(1, "active", "09:00", "12:00"),
    seg(1, "idle", "12:00", "12:30"),
    seg(1, "active", "12:30", "17:00"),
  ];
  const m = mergeDeviceDays({ pcSessions: [pcA], intervals });
  assert.equal(m.multi_device, false);
  assert.equal(m.gap_seconds, 0);
  assert.equal(m.covered_seconds, m.span_seconds);
  assert.equal(m.overlap_seconds, 0);
  assert.equal(m.idle_seconds, 1800);
  assert.equal(m.active_seconds, 8 * 3600 - 1800);
  assertMergeInvariant(m, "single-device-merge");
});

test("merge with no pc sessions -> null", () => {
  assert.equal(mergeDeviceDays({ pcSessions: [] }), null);
});
