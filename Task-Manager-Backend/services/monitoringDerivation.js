"use strict";

/**
 * Derivation engine (Phase 2).
 *
 * The desktop agent only emits append-only raw events. Everything the dashboard
 * shows — PC sessions, the active/idle/screen-off/untracked partition, app and
 * website sessions, the timeline, and the per-user daily summary — is DERIVED
 * here from those events and is fully recomputable.
 *
 * Contracts honoured:
 *   - Day boundary = server local date (Decision 5). Everything is clipped to
 *     [dayStart, dayEnd); an interval crossing midnight is split so each
 *     local_date's invariant holds on its own (Confirmation 3).
 *   - Per-device 4-way partition, precedence screen_off > untracked > idle >
 *     active, active = remainder:
 *         active + idle + screen_off + untracked == total   (± rounding, the
 *         residual is stored in reconciliation_delta_seconds).
 *   - app_sessions AND web_sessions are both carved out of screen_off ∪
 *     untracked (no foreground app when the screen is off or the agent is not
 *     running).
 *   - The per-user summary is a wall-clock UNION merge across the user's
 *     devices, precedence active > idle > screen_off > untracked, never a sum;
 *     top_apps / top_domains are summed and NOT clamped.
 *   - The whole (agent, local_date) partition is delete-and-rewrite inside one
 *     transaction.
 *
 * The pure functions (deriveDayFromEvents, mergeDeviceDays) take plain data and
 * no DB — they are what the fixture tests exercise. recomputeDay /
 * recomputeUserDaySummary are the thin DB wrappers.
 */

const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const models = require("../models");
const im = require("../utils/intervalMath");
const { serverLocalDate } = require("../utils/monitoringTime");

const LIFECYCLE_TYPES = ["agent_start", "heartbeat", "agent_stop", "session_end"];

// os_boot_time is fixed once per agent run (see the agent's events.js), so it is
// constant WITHIN a run and only differs ACROSS runs. Across two runs of the
// SAME physical boot it can still differ by ~1-2s (os.uptime() granularity +
// scheduling between the two agent_start moments). A change larger than this
// tolerance means the machine actually rebooted. The window is deliberately
// wide — anything under it is treated as the same boot.
const REBOOT_OS_DELTA_MS = 5 * 60 * 1000;
// A gap between two events of the SAME agent run longer than this (agent hung,
// or the machine slept without a powerMonitor suspend reaching us) is
// "untracked". powerMonitor suspend/resume (Phase 3) reclassifies real sleep as
// screen_off before this ever triggers.
const SAME_RUN_GAP_UNTRACKED_MS = 5 * 60 * 1000;

// Which screen-off reason is the "primary" one when several overlap (§2a).
const REASON_PRECEDENCE = ["reboot", "sleep", "locked", "display_off"];
function pickPrimaryReason(reasons) {
  if (!reasons || reasons.length === 0) return "display_off";
  return [...reasons].sort(
    (a, b) => REASON_PRECEDENCE.indexOf(a) - REASON_PRECEDENCE.indexOf(b)
  )[0];
}
// While `local_date` is today, a last heartbeat newer than this means the agent
// is still alive → the session is provisional, not an unclean shutdown.
const PROVISIONAL_FRESH_MS = 3 * 60 * 1000;

const TOP_N = 25;

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function ms(value) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function parseLocalDate(localDate) {
  const [y, m, d] = String(localDate).split("-").map(Number);
  return {
    dayStart: new Date(y, m - 1, d, 0, 0, 0, 0),
    dayEnd: new Date(y, m - 1, d + 1, 0, 0, 0, 0),
  };
}

// Canonical browser id from an app_focus application_name ("Google Chrome" ->
// "chrome"). Mirrors the agent's domainDetector.canonicalBrowser. Order matters
// so "Microsoft Edge" is not misread as chrome.
const BROWSER_ID_ORDER = ["edge", "chrome", "firefox", "brave", "opera", "vivaldi", "chromium"];
function canonicalBrowser(applicationName) {
  if (!applicationName || typeof applicationName !== "string") return null;
  const name = applicationName.toLowerCase();
  for (const id of BROWSER_ID_ORDER) if (name.includes(id)) return id;
  return null;
}

function cmpEvent(a, b) {
  const ta = ms(a.occurred_at);
  const tb = ms(b.occurred_at);
  if (ta !== tb) return ta - tb;
  const sa = Number.isFinite(a.client_seq) ? a.client_seq : 0;
  const sb = Number.isFinite(b.client_seq) ? b.client_seq : 0;
  return sa - sb;
}

const clipIvls = (ivls, lo, hi) =>
  ivls
    .map((iv) => ({ ...iv, start: Math.max(iv.start, lo), end: Math.min(iv.end, hi) }))
    .filter((iv) => iv.end > iv.start);

const seconds = (ivls) => im.totalSeconds(ivls.map((iv) => ({ start: iv.start, end: iv.end })));

// ---------------------------------------------------------------------------
// per-dimension interval builders (pure)
// ---------------------------------------------------------------------------

// Reasons carried by a screen_state 'off' event: prefer the explicit set,
// fall back to the single `reason`, then "display_off".
function reasonSetOf(payload) {
  if (payload && Array.isArray(payload.reasons) && payload.reasons.length) {
    return [...new Set(payload.reasons)];
  }
  if (payload && payload.reason) return [payload.reason];
  return ["display_off"];
}

function sameReasonSet(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

// Screen-off intervals from screen_state events. A change in the REASON SET
// while the screen stays off (§2a: lock added on top of display-off, etc.)
// splits into adjacent sub-intervals, each carrying its own reason set.
function buildDisplayOffIntervals(screenEvents, prior, firstOn, finalOff) {
  const out = [];
  let offSince = null;
  let offReasons = null;

  const flush = (end) => {
    if (offSince !== null && end > offSince) {
      out.push({ start: offSince, end, reasons: offReasons });
    }
  };

  const entry = prior && prior.screen_state;
  if (entry && entry.payload && entry.payload.state === "off") {
    offSince = firstOn;
    offReasons = reasonSetOf(entry.payload);
  }

  for (const e of screenEvents) {
    const t = ms(e.occurred_at);
    const state = e.payload && e.payload.state;
    if (state === "off") {
      const reasons = reasonSetOf(e.payload);
      if (offSince === null) {
        offSince = t;
        offReasons = reasons;
      } else if (!sameReasonSet(reasons, offReasons)) {
        flush(t);
        offSince = t;
        offReasons = reasons;
      }
    } else if (state === "on") {
      if (offSince !== null) {
        flush(t);
        offSince = null;
        offReasons = null;
      }
    }
  }
  flush(finalOff);

  return clipIvls(out, firstOn, finalOff).map((iv) => ({
    start: iv.start,
    end: iv.end,
    reason: pickPrimaryReason(iv.reasons),
    reasons: iv.reasons && iv.reasons.length > 1 ? iv.reasons : null,
  }));
}

// Reboot vs agent-restart vs same-run stall, from run_id + os_boot_time.
function buildGapIntervals(dayEvents, prior, firstOn, finalOff) {
  const reboot = [];
  const untracked = [];

  const points = [];
  const anchor = (prior && prior.mostRecent) || (prior && prior.lifecycle) || null;
  if (anchor) {
    points.push({ t: ms(anchor.occurred_at), run: anchor.run_id, boot: anchor.os_boot_time });
  }
  for (const e of dayEvents) {
    points.push({ t: ms(e.occurred_at), run: e.run_id, boot: e.os_boot_time });
  }

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (b.t <= a.t) continue;
    const runChanged = a.run && b.run && a.run !== b.run;
    const bootChanged =
      Number.isFinite(a.boot) &&
      Number.isFinite(b.boot) &&
      Math.abs(b.boot - a.boot) > REBOOT_OS_DELTA_MS;

    if (runChanged && bootChanged) {
      reboot.push({ start: a.t, end: b.t });
    } else if (runChanged) {
      untracked.push({ start: a.t, end: b.t });
    } else if (!runChanged && b.t - a.t > SAME_RUN_GAP_UNTRACKED_MS) {
      untracked.push({ start: a.t, end: b.t });
    }
  }

  return {
    reboot: clipIvls(reboot, firstOn, finalOff),
    untracked: clipIvls(untracked, firstOn, finalOff),
  };
}

function buildIdleIntervals(inputEvents, prior, firstOn, finalOff) {
  const out = [];
  let idleSince = null;

  const entry = prior && prior.input_state;
  if (entry && entry.payload && entry.payload.state === "idle") {
    idleSince = firstOn; // an idle period already in progress at the day boundary
  }

  for (const e of inputEvents) {
    const t = ms(e.occurred_at);
    const state = e.payload && e.payload.state;
    if (state === "idle") {
      if (idleSince === null) {
        const li = e.payload && e.payload.last_input_at ? ms(e.payload.last_input_at) : t;
        idleSince = li; // back-dated to the last input
      }
    } else if (state === "active") {
      if (idleSince !== null) {
        out.push({ start: idleSince, end: t });
        idleSince = null;
      }
    }
  }
  if (idleSince !== null) out.push({ start: idleSince, end: finalOff });

  return clipIvls(out, firstOn, finalOff);
}

function buildAppSpans(focusEvents, prior, firstOn, finalOff) {
  const spans = [];
  let cur = null;

  const entry = prior && prior.app_focus;
  if (entry && entry.payload && entry.payload.application_name) {
    cur = {
      app: entry.payload.application_name,
      title: entry.payload.window_title || null,
      start: firstOn,
    };
  }

  for (const e of focusEvents) {
    const t = Math.max(ms(e.occurred_at), firstOn);
    const app = (e.payload && e.payload.application_name) || "Unknown";
    const title = (e.payload && e.payload.window_title) || null;
    if (cur) {
      if (t > cur.start) spans.push({ ...cur, end: t });
      cur = { app, title, start: t };
    } else {
      cur = { app, title, start: t };
    }
  }
  if (cur && finalOff > cur.start) spans.push({ ...cur, end: finalOff });

  return spans.filter((s) => s.end > s.start && s.end <= finalOff && s.start >= firstOn);
}

function buildBrowserSpans(browserEvents, prior, firstOn, finalOff) {
  const spans = [];
  let cur = null;

  const entry = prior && prior.browser_state;
  if (entry && entry.payload && entry.payload.browser) {
    cur = {
      browser: entry.payload.browser,
      domain: entry.payload.domain || null,
      isPrivate: Boolean(entry.payload.is_private),
      start: firstOn,
    };
  }

  for (const e of browserEvents) {
    const t = Math.max(ms(e.occurred_at), firstOn);
    const p = e.payload || {};
    if (cur) {
      if (t > cur.start) spans.push({ ...cur, end: t });
    }
    cur = {
      browser: p.browser || (cur && cur.browser) || "unknown",
      domain: p.domain || null,
      isPrivate: Boolean(p.is_private),
      start: t,
    };
  }
  if (cur && finalOff > cur.start) spans.push({ ...cur, end: finalOff });

  return spans.filter((s) => s.end > s.start);
}

// Which screen_off reason(s) cover a partition segment — the union of every
// covering raw interval's reason set (§2a).
function reasonForScreenSegment(seg, screenOffRaw) {
  const mid = (seg.start + seg.end) / 2;
  const covering = screenOffRaw.filter((iv) => iv.start <= mid && mid < iv.end);
  if (covering.length === 0) return { reason: "display_off", reasons: null };
  const all = new Set();
  for (const c of covering) {
    if (Array.isArray(c.reasons) && c.reasons.length) c.reasons.forEach((r) => all.add(r));
    else if (c.reason) all.add(c.reason);
  }
  const merged = [...all];
  return {
    reason: pickPrimaryReason(merged),
    reasons: merged.length > 1 ? merged : null,
  };
}

// ---------------------------------------------------------------------------
// deriveDayFromEvents — the pure core
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {Array}  opts.dayEvents   events with local_date === this day, any order
 * @param {object} [opts.prior]     entry state: { screen_state, input_state,
 *                                   app_focus, browser_state, lifecycle,
 *                                   mostRecent } — each a raw event or null
 * @param {Date}   opts.dayStart
 * @param {Date}   opts.dayEnd
 * @param {Date}   [opts.now]
 * @param {boolean}[opts.isToday]
 * @param {boolean}[opts.hasNextDayContinuation]  an event >= dayEnd exists that
 *                                   is not an agent_start (session runs on)
 * @returns {null | { pcSession, intervals, appSessions, webSessions }}
 */
function deriveDayFromEvents(opts) {
  const dayStart = ms(opts.dayStart);
  const dayEnd = ms(opts.dayEnd);
  const now = opts.now ? ms(opts.now) : Date.now();
  const isToday = Boolean(opts.isToday);
  const hasNext = Boolean(opts.hasNextDayContinuation);
  const prior = opts.prior || {};

  const dayEvents = [...(opts.dayEvents || [])].sort(cmpEvent);
  if (dayEvents.length === 0) return null;

  const clampDay = (t) => Math.min(Math.max(t, dayStart), dayEnd);

  const first = dayEvents[0];
  const last = dayEvents[dayEvents.length - 1];
  const firstMs = ms(first.occurred_at);
  const lastMs = ms(last.occurred_at);

  // ---- PC session bounds ----
  let firstOn;
  if (first.type === "agent_start") firstOn = clampDay(firstMs);
  else if (prior.lifecycle) firstOn = dayStart; // running across midnight
  else firstOn = clampDay(firstMs);

  let finalOff;
  let uncleanShutdown = false;
  let isProvisional = false;

  if (last.type === "agent_stop" || last.type === "session_end") {
    finalOff = clampDay(lastMs);
  } else if (hasNext) {
    finalOff = dayEnd;
  } else if (isToday && now - lastMs <= PROVISIONAL_FRESH_MS) {
    finalOff = clampDay(lastMs);
    isProvisional = true;
  } else {
    finalOff = clampDay(lastMs);
    uncleanShutdown = true;
  }

  if (finalOff < firstOn) finalOff = firstOn;

  // ---- per-dimension intervals ----
  const screenEvents = dayEvents.filter((e) => e.type === "screen_state");
  const inputEvents = dayEvents.filter((e) => e.type === "input_state");
  const focusEvents = dayEvents.filter((e) => e.type === "app_focus");
  const browserEvents = dayEvents.filter((e) => e.type === "browser_state");

  const displayOff = buildDisplayOffIntervals(screenEvents, prior, firstOn, finalOff);
  const gaps = buildGapIntervals(dayEvents, prior, firstOn, finalOff);
  const idle = buildIdleIntervals(inputEvents, prior, firstOn, finalOff);

  const screenOffRaw = [
    ...displayOff,
    ...gaps.reboot.map((iv) => ({
      start: iv.start,
      end: iv.end,
      reason: "reboot",
      reasons: ["reboot"],
    })),
  ];
  const screenOffIvls = screenOffRaw.map((iv) => ({ start: iv.start, end: iv.end }));

  // ---- 4-way partition (precedence screen_off > untracked > idle > active) ----
  const segments = im.partitionByPriority(
    firstOn,
    finalOff,
    [
      { label: "screen_off", intervals: screenOffIvls },
      { label: "untracked", intervals: gaps.untracked },
      { label: "idle", intervals: idle },
    ],
    { fillLabel: "active" }
  );

  const bucket = (label) =>
    segments.filter((s) => s.label === label).map((s) => ({ start: s.start, end: s.end }));
  const activeIvls = bucket("active");
  const idleSeg = bucket("idle");
  const screenOffSeg = bucket("screen_off");
  const untrackedSeg = bucket("untracked");

  const totalSeconds = Math.round((finalOff - firstOn) / 1000);
  const activeSeconds = seconds(activeIvls);
  const idleSeconds = seconds(idleSeg);
  const screenOffSeconds = seconds(screenOffSeg);
  const untrackedSeconds = seconds(untrackedSeg);
  const reconciliationDelta =
    totalSeconds - (activeSeconds + idleSeconds + screenOffSeconds + untrackedSeconds);

  // ---- interval rows ----
  // A screen_off partition segment is contiguous, but the raw reason set can
  // change while the screen stays off (§2a: lock added on top of display-off).
  // Re-cut each screen_off segment at those raw boundaries so every row carries
  // a single reason set.
  const splitAtRawBoundaries = (seg) => {
    const cuts = new Set([seg.start, seg.end]);
    for (const raw of screenOffRaw) {
      if (raw.start > seg.start && raw.start < seg.end) cuts.add(raw.start);
      if (raw.end > seg.start && raw.end < seg.end) cuts.add(raw.end);
    }
    const sorted = [...cuts].sort((a, b) => a - b);
    const pieces = [];
    for (let i = 1; i < sorted.length; i += 1) {
      pieces.push({ start: sorted[i - 1], end: sorted[i] });
    }
    return pieces;
  };

  const intervals = segments.flatMap((seg) => {
    if (seg.label !== "screen_off") {
      return [
        {
          type: seg.label,
          screen_off_reason: null,
          reasons: null,
          started_at: new Date(seg.start),
          ended_at: new Date(seg.end),
          duration_seconds: Math.round((seg.end - seg.start) / 1000),
        },
      ];
    }
    return splitAtRawBoundaries(seg).map((piece) => {
      const r = reasonForScreenSegment(piece, screenOffRaw);
      return {
        type: "screen_off",
        screen_off_reason: r.reason,
        reasons: r.reasons,
        started_at: new Date(piece.start),
        ended_at: new Date(piece.end),
        duration_seconds: Math.round((piece.end - piece.start) / 1000),
      };
    });
  });

  // ---- app + web sessions (carved out of screen_off ∪ untracked) ----
  const carveOut = im.union(screenOffIvls, gaps.untracked);

  const appSpans = buildAppSpans(focusEvents, prior, firstOn, finalOff);
  const appSessions = [];
  for (const span of appSpans) {
    const pieces = im.subtract([{ start: span.start, end: span.end }], carveOut);
    for (const p of pieces) {
      appSessions.push({
        application_name: span.app || "Unknown",
        started_at: new Date(p.start),
        ended_at: new Date(p.end),
        duration_seconds: Math.round((p.end - p.start) / 1000),
        active_seconds: seconds(im.intersect([p], activeIvls)),
      });
    }
  }

  const browserFocused = {};
  for (const span of appSpans) {
    const b = canonicalBrowser(span.app);
    if (!b) continue;
    (browserFocused[b] = browserFocused[b] || []).push({ start: span.start, end: span.end });
  }
  for (const b of Object.keys(browserFocused)) {
    browserFocused[b] = im.normalize(browserFocused[b]);
  }

  const browserSpans = buildBrowserSpans(browserEvents, prior, firstOn, finalOff);
  const webSessions = [];
  for (const span of browserSpans) {
    const focused = browserFocused[span.browser] || [];
    let live = im.intersect([{ start: span.start, end: span.end }], focused);
    live = im.subtract(live, carveOut);
    for (const p of live) {
      webSessions.push({
        browser: span.browser,
        domain: span.isPrivate ? null : span.domain || null,
        is_private: Boolean(span.isPrivate),
        started_at: new Date(p.start),
        ended_at: new Date(p.end),
        duration_seconds: Math.round((p.end - p.start) / 1000),
        active_seconds: seconds(im.intersect([p], activeIvls)),
      });
    }
  }

  // period counts from the raw dimension intervals (how many times the user
  // went idle / the screen went off), not the post-partition fragments.
  const idlePeriodCount = im.normalize(idle).length;
  const screenOffPeriodCount = im.normalize(screenOffIvls).length;

  return {
    pcSession: {
      first_pc_on: new Date(firstOn),
      final_pc_off: new Date(finalOff),
      total_seconds: totalSeconds,
      active_seconds: activeSeconds,
      idle_seconds: idleSeconds,
      screen_off_seconds: screenOffSeconds,
      untracked_seconds: untrackedSeconds,
      idle_period_count: idlePeriodCount,
      screen_off_period_count: screenOffPeriodCount,
      unclean_shutdown: uncleanShutdown,
      is_provisional: isProvisional,
      reconciliation_delta_seconds: reconciliationDelta,
      source_event_count: dayEvents.length,
    },
    intervals,
    appSessions,
    webSessions,
  };
}

// ---------------------------------------------------------------------------
// mergeDeviceDays — the pure per-user cross-device union merge
// ---------------------------------------------------------------------------

function topList(rows, keyFn, labelKey) {
  const map = new Map();
  for (const r of rows) {
    const key = keyFn(r);
    if (!map.has(key)) map.set(key, { [labelKey]: key, seconds: 0, sessions: 0 });
    const e = map.get(key);
    e.seconds += Number(r.duration_seconds) || 0;
    e.sessions += 1;
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds).slice(0, TOP_N);
}

/**
 * @param {object} input
 * @param {Array} input.pcSessions   this user's device-day pc_session rows
 * @param {Array} input.intervals    all their monitoring_intervals rows
 * @param {Array} input.appSessions  all their monitoring_app_sessions rows
 * @param {Array} input.webSessions  all their monitoring_web_sessions rows
 * @returns {object|null} the monitoring_user_day_summaries field set (no ids)
 */
function mergeDeviceDays({ pcSessions, intervals = [], appSessions = [], webSessions = [] }) {
  if (!pcSessions || pcSessions.length === 0) return null;

  const firstOn = Math.min(...pcSessions.map((p) => ms(p.first_pc_on)));
  const finalOff = Math.max(...pcSessions.map((p) => ms(p.final_pc_off)));
  const spanSeconds = Math.max(0, Math.round((finalOff - firstOn) / 1000));

  const spanIvls = pcSessions
    .map((p) => ({ start: ms(p.first_pc_on), end: ms(p.final_pc_off) }))
    .filter((iv) => iv.end > iv.start);
  const covered = im.union(spanIvls);
  const coveredSeconds = im.totalSeconds(covered);
  const gapSeconds = Math.max(0, spanSeconds - coveredSeconds);

  const ivlsByType = (type) =>
    im.union(
      intervals
        .filter((i) => i.type === type)
        .map((i) => ({ start: ms(i.started_at), end: ms(i.ended_at) }))
    );

  const activeU = ivlsByType("active");
  const idleU = im.subtract(ivlsByType("idle"), activeU);
  const screenOffU = im.subtract(im.subtract(ivlsByType("screen_off"), activeU), idleU);
  const untrackedU = im.subtract(covered, im.union(activeU, idleU, screenOffU));

  const activeSeconds = im.totalSeconds(activeU);
  const idleSeconds = im.totalSeconds(idleU);
  const screenOffSeconds = im.totalSeconds(screenOffU);
  const untrackedSeconds = im.totalSeconds(untrackedU);

  const sumDeviceTotals = pcSessions.reduce((s, p) => s + (Number(p.total_seconds) || 0), 0);
  const overlapSeconds = Math.max(0, sumDeviceTotals - coveredSeconds);

  const topApps = topList(appSessions, (r) => r.application_name || "Unknown", "name");
  const topDomains = topList(
    webSessions,
    (r) => (r.is_private ? "Private Browsing" : r.domain || "Unknown"),
    "domain"
  ).map((d) => ({ ...d, is_private: d.domain === "Private Browsing" }));

  return {
    device_count: pcSessions.length,
    multi_device: pcSessions.length > 1,
    first_pc_on: new Date(firstOn),
    final_pc_off: new Date(finalOff),
    span_seconds: spanSeconds,
    covered_seconds: coveredSeconds,
    gap_seconds: gapSeconds,
    active_seconds: activeSeconds,
    idle_seconds: idleSeconds,
    screen_off_seconds: screenOffSeconds,
    untracked_seconds: untrackedSeconds,
    overlap_seconds: overlapSeconds,
    idle_period_count: idleU.length,
    screen_off_period_count: screenOffU.length,
    unclean_shutdown: pcSessions.some((p) => p.unclean_shutdown),
    is_provisional: pcSessions.some((p) => p.is_provisional),
    top_apps: topApps,
    top_domains: topDomains,
    reconciliation_delta_seconds:
      coveredSeconds - (activeSeconds + idleSeconds + screenOffSeconds + untrackedSeconds),
  };
}

// ---------------------------------------------------------------------------
// DB wrappers
// ---------------------------------------------------------------------------

async function loadPriorState(agentId, dayStart) {
  const prior = {};
  const stateTypes = ["screen_state", "input_state", "app_focus", "browser_state"];
  await Promise.all(
    stateTypes.map(async (type) => {
      prior[type] = await models.MonitoringEvent.findOne({
        where: { agent_id: agentId, type, occurred_at: { [Op.lt]: dayStart } },
        order: [["occurred_at", "DESC"]],
        raw: true,
      });
    })
  );
  prior.lifecycle = await models.MonitoringEvent.findOne({
    where: {
      agent_id: agentId,
      type: { [Op.in]: LIFECYCLE_TYPES },
      occurred_at: { [Op.lt]: dayStart },
    },
    order: [["occurred_at", "DESC"]],
    raw: true,
  });
  prior.mostRecent = await models.MonitoringEvent.findOne({
    where: { agent_id: agentId, occurred_at: { [Op.lt]: dayStart } },
    order: [["occurred_at", "DESC"]],
    raw: true,
  });
  return prior;
}

/**
 * Recompute one device-day and the user-day summary it rolls into.
 * @returns {{ ok: boolean, hadEvents: boolean }}
 */
async function recomputeDay(agentId, localDate) {
  const agent = await models.MonitoringAgent.findByPk(agentId, { raw: true });
  if (!agent) return { ok: false, hadEvents: false, reason: "agent-missing" };

  const { dayStart, dayEnd } = parseLocalDate(localDate);

  const dayEvents = await models.MonitoringEvent.findAll({
    where: { agent_id: agentId, local_date: localDate },
    order: [
      ["occurred_at", "ASC"],
      ["client_seq", "ASC"],
      ["id", "ASC"],
    ],
    raw: true,
  });

  const prior = await loadPriorState(agentId, dayStart);
  const nextEvent = await models.MonitoringEvent.findOne({
    where: { agent_id: agentId, occurred_at: { [Op.gte]: dayEnd } },
    order: [["occurred_at", "ASC"]],
    raw: true,
  });
  const hasNextDayContinuation = Boolean(nextEvent && nextEvent.type !== "agent_start");

  const derived =
    dayEvents.length > 0
      ? deriveDayFromEvents({
          dayEvents,
          prior,
          dayStart,
          dayEnd,
          now: new Date(),
          isToday: serverLocalDate(new Date()) === localDate,
          hasNextDayContinuation,
        })
      : null;

  await sequelize.transaction(async (transaction) => {
    const existing = await models.MonitoringPcSession.findOne({
      where: { agent_id: agentId, local_date: localDate },
      transaction,
    });
    if (existing) await existing.destroy({ transaction }); // FK CASCADE -> children

    if (derived) {
      const pc = await models.MonitoringPcSession.create(
        {
          organization_id: agent.organization_id,
          user_id: agent.user_id,
          agent_id: agentId,
          local_date: localDate,
          ...derived.pcSession,
          recomputed_at: new Date(),
        },
        { transaction }
      );

      const withParent = (rows) => rows.map((r) => ({ ...r, pc_session_id: pc.id }));
      if (derived.intervals.length) {
        await models.MonitoringInterval.bulkCreate(withParent(derived.intervals), { transaction });
      }
      if (derived.appSessions.length) {
        await models.MonitoringAppSession.bulkCreate(withParent(derived.appSessions), { transaction });
      }
      if (derived.webSessions.length) {
        await models.MonitoringWebSession.bulkCreate(withParent(derived.webSessions), { transaction });
      }
    }

    await recomputeUserDaySummary(
      { organizationId: agent.organization_id, userId: agent.user_id, localDate },
      transaction
    );
  });

  return { ok: true, hadEvents: dayEvents.length > 0 };
}

async function recomputeUserDaySummary({ organizationId, userId, localDate }, transaction) {
  const pcSessions = await models.MonitoringPcSession.findAll({
    where: { user_id: userId, local_date: localDate },
    transaction,
    raw: true,
  });

  if (pcSessions.length === 0) {
    await models.MonitoringUserDaySummary.destroy({
      where: { user_id: userId, local_date: localDate },
      transaction,
    });
    return;
  }

  const ids = pcSessions.map((p) => p.id);
  const [intervals, appSessions, webSessions] = await Promise.all([
    models.MonitoringInterval.findAll({ where: { pc_session_id: { [Op.in]: ids } }, transaction, raw: true }),
    models.MonitoringAppSession.findAll({ where: { pc_session_id: { [Op.in]: ids } }, transaction, raw: true }),
    models.MonitoringWebSession.findAll({ where: { pc_session_id: { [Op.in]: ids } }, transaction, raw: true }),
  ]);

  const merged = mergeDeviceDays({ pcSessions, intervals, appSessions, webSessions });

  await models.MonitoringUserDaySummary.upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      local_date: localDate,
      ...merged,
      recomputed_at: new Date(),
    },
    { transaction }
  );
}

module.exports = {
  // pure
  deriveDayFromEvents,
  mergeDeviceDays,
  canonicalBrowser,
  parseLocalDate,
  pickPrimaryReason,
  // db
  recomputeDay,
  recomputeUserDaySummary,
  loadPriorState,
  // constants (for tests / tuning)
  REBOOT_OS_DELTA_MS,
  SAME_RUN_GAP_UNTRACKED_MS,
  PROVISIONAL_FRESH_MS,
};
