// Helpers shared across the Monitoring dashboard.
//
// Phase 5: the dashboard reads ONLY the derived API (GET /monitoring/summary and
// GET /monitoring/daily). The old client-side grouping of raw
// GET /monitoring/activities rows (groupByEmployee / groupByApplication /
// summarise / deriveStatus) and the ACTIVITY_TYPES / TYPE_META constants that fed
// the removed MonitoringFilters were deleted here. Only formatting and
// derived-response helpers remain.

export function employeeName(user) {
  if (!user) return "Unknown employee";
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return name || user.email || "Unknown employee";
}

export function formatClock(value) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Human-readable tracked duration. Shows real precision instead of collapsing
// everything under a minute to "<1m":
//   < 1 min   -> "45s"
//   < 1 hour  -> "12m"
//   >= 1 hour -> "1h 15m"
export function formatHm(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function formatRelative(value) {
  if (!value) return "--";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ---------------------------------------------------------------------------
// Phase 2 — derived summary / day-detail helpers
// ---------------------------------------------------------------------------

// YYYY-MM-DD in local time (matches the backend's server-local day boundary).
export function isoDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftIsoDate(iso, deltaDays) {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + deltaDays));
}

export function formatIsoDateLong(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Presence for a day summary row. Provisional (agent still beating today) reads
// as Active; otherwise it is a completed day. Used by the employee-list cards,
// which only have the merged summary (no per-interval detail).
export function summaryStatus(summary) {
  if (!summary) return { label: "No data", tone: "neutral" };
  if (summary.is_provisional) return { label: "Active", tone: "success" };
  if (summary.unclean_shutdown) return { label: "Ended (unclean)", tone: "warning" };
  return { label: "Ended", tone: "neutral" };
}

// ---------------------------------------------------------------------------
// "Live Active" status — the precise, real-time state of one device.
//
// Definition: for a PROVISIONAL pc_session (today, last agent event within
// PROVISIONAL_FRESH_MS / ~3 min — i.e. the agent is still reporting) the state
// is read from the LAST classified interval, which ends at that last event and
// so reflects what is happening right now:
//
//   provisional, last interval …
//     active                          -> "Active"        (green)  at the keyboard / mouse
//     idle                            -> "Idle"          (amber)  no input > 5 min, screen still on
//     screen_off + reason "locked"    -> "Locked"        (slate)  workstation locked, PC running
//     screen_off + reason "display_off" -> "Screen off"  (slate)  monitor/display off, PC running
//     screen_off + reason "sleep"     -> "Sleeping"      (slate)  system sleep/standby
//     screen_off + reason "reboot"    -> "Restarting"    (slate)
//     untracked                       -> "Not reporting" (amber)  agent process gone but session fresh
//
//   NOT provisional …
//     clean agent stop / session end  -> "Offline"       (slate)  PC shut down / signed out cleanly
//     stale or unclean shutdown       -> "Offline"       (amber)  power-cut / crash / lost connection
//     no pc_session                   -> "No data"
//
// Nothing new is tracked here — it is a read of the existing derived
// pc_session + monitoring_intervals rows. Pair with the ~30s auto-refresh so
// the badge follows the data.
export function deviceLiveStatus(device) {
  const pc = device?.pc_session;
  if (!pc) return { label: "No data", tone: "neutral", live: false };

  if (!pc.is_provisional) {
    return pc.unclean_shutdown
      ? { label: "Offline", tone: "warning", live: false, hint: "connection lost / unclean" }
      : { label: "Offline", tone: "neutral", live: false, hint: "PC powered off" };
  }

  const ivs = device.intervals || [];
  const last = ivs[ivs.length - 1];
  if (!last) return { label: "Live", tone: "success", live: true };

  if (last.type === "active") return { label: "Active", tone: "success", live: true };
  if (last.type === "idle") return { label: "Idle", tone: "warning", live: true };
  if (last.type === "untracked")
    return { label: "Not reporting", tone: "warning", live: true, hint: "agent not sending events" };
  if (last.type === "screen_off") {
    const r = last.screen_off_reason;
    if (r === "locked") return { label: "Locked", tone: "neutral", live: true };
    if (r === "sleep") return { label: "Sleeping", tone: "neutral", live: true };
    if (r === "reboot") return { label: "Restarting", tone: "neutral", live: true };
    return { label: "Screen off", tone: "neutral", live: true }; // display_off / default
  }
  return { label: "Live", tone: "success", live: true };
}

// Roll per-device states up to one badge for the whole day view: the most
// "present" device wins.
const LIVE_STATUS_ORDER = [
  "Active",
  "Idle",
  "Not reporting",
  "Locked",
  "Sleeping",
  "Restarting",
  "Screen off",
  "Live",
  "Offline",
  "No data",
];
export function overallLiveStatus(devices) {
  const list = (devices || []).map(deviceLiveStatus);
  if (list.length === 0) return { label: "No data", tone: "neutral", live: false };
  return [...list].sort(
    (a, b) => LIVE_STATUS_ORDER.indexOf(a.label) - LIVE_STATUS_ORDER.indexOf(b.label),
  )[0];
}

// Colour + label for a timeline / interval segment type.
export const INTERVAL_META = {
  active: { label: "Active", cls: "bg-emerald-500", tone: "success" },
  idle: { label: "Idle", cls: "bg-amber-400", tone: "warning" },
  screen_off: { label: "Screen off", cls: "bg-slate-400", tone: "neutral" },
  untracked: { label: "Untracked", cls: "bg-slate-300 dark:bg-slate-600", tone: "neutral" },
};

export const SCREEN_OFF_REASON_LABEL = {
  display_off: "Display off",
  locked: "Locked",
  sleep: "Sleep",
  reboot: "Reboot",
};

// (Phase 5) deriveStatus / groupByEmployee / summarise / groupByApplication were
// removed here — the dashboard no longer groups raw GET /monitoring/activities
// rows client-side. Employee cards come from GET /monitoring/summary
// (monitoring_user_day_summaries) and the day view from GET /monitoring/daily.

// ---------------------------------------------------------------------------
// Day-detail: unified "Applications & Websites" + chronological "Activity Logs"
//
// Both are derived purely from the GET /monitoring/daily response
// (devices[].app_sessions / web_sessions / intervals). Nothing here fetches,
// hardcodes, or invents data — every row corresponds to a derived session/
// interval the monitoring pipeline already produced.
// ---------------------------------------------------------------------------

// Canonical browser id from an application_name. Mirrors the agent's
// domainDetector.canonicalBrowser / the backend derivation so web sessions
// (keyed by "chrome", "edge", …) can be matched back to their app entry
// ("Google Chrome", "Microsoft Edge", …). Order matters — "Microsoft Edge"
// must not resolve to chrome.
const BROWSER_ID_ORDER = ["edge", "chrome", "firefox", "brave", "opera", "vivaldi", "chromium"];
export function canonicalBrowser(applicationName) {
  if (!applicationName || typeof applicationName !== "string") return null;
  const n = applicationName.toLowerCase();
  return BROWSER_ID_ORDER.find((id) => n.includes(id)) || null;
}

const ms = (v) => {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};
const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const domainLabel = (w) =>
  w.is_private ? "Private browsing" : w.domain || "Unknown site";

/**
 * Unified Applications & Websites for one device.
 *
 * Each application appears ONCE. A browser's per-domain web sessions are nested
 * under its application entry (Chrome → claude.ai, youtube.com, …). The parent
 * entry keeps the application's own totals (foreground time); the nested domain
 * rows are a breakdown of that same time, never added on top — so grouping does
 * not double-count.
 *
 * Web sessions whose browser has no matching application entry still get a
 * synthetic group so nothing is hidden.
 *
 * @returns {Array<{
 *   key:string, label:string, browserId:string|null,
 *   seconds:number, active:number, sessions:number, lastSeen:number,
 *   domains:Array<{label:string, seconds:number, active:number, sessions:number, lastSeen:number, isPrivate:boolean}>
 * }>} sorted by duration desc
 */
export function buildAppWebGroups(device) {
  const apps = new Map();
  for (const a of device?.app_sessions || []) {
    const label = a.application_name || "Unknown";
    const e =
      apps.get(label) ||
      {
        key: label,
        label,
        browserId: canonicalBrowser(label),
        seconds: 0,
        active: 0,
        sessions: 0,
        lastSeen: 0,
        domains: [],
      };
    e.seconds += a.duration_seconds || 0;
    e.active += a.active_seconds || 0;
    e.sessions += 1;
    e.lastSeen = Math.max(e.lastSeen, ms(a.ended_at));
    apps.set(label, e);
  }

  // web sessions -> browserId -> domain aggregates
  const webByBrowser = new Map();
  for (const w of device?.web_sessions || []) {
    const bid = (w.browser || "browser").toLowerCase();
    if (!webByBrowser.has(bid)) webByBrowser.set(bid, new Map());
    const dmap = webByBrowser.get(bid);
    const dl = domainLabel(w);
    const de =
      dmap.get(dl) ||
      { label: dl, seconds: 0, active: 0, sessions: 0, lastSeen: 0, isPrivate: !!w.is_private };
    de.seconds += w.duration_seconds || 0;
    de.active += w.active_seconds || 0;
    de.sessions += 1;
    de.lastSeen = Math.max(de.lastSeen, ms(w.ended_at));
    dmap.set(dl, de);
  }

  const attached = new Set();
  for (const app of apps.values()) {
    if (app.browserId && webByBrowser.has(app.browserId)) {
      app.domains = [...webByBrowser.get(app.browserId).values()].sort(
        (x, y) => y.seconds - x.seconds,
      );
      attached.add(app.browserId);
    }
  }

  // browsers with web activity but no application session (shouldn't usually
  // happen, but never drop data)
  for (const [bid, dmap] of webByBrowser.entries()) {
    if (attached.has(bid)) continue;
    const domains = [...dmap.values()].sort((x, y) => y.seconds - x.seconds);
    apps.set(`__web_${bid}`, {
      key: `__web_${bid}`,
      label: titleCase(bid),
      browserId: bid,
      seconds: domains.reduce((s, d) => s + d.seconds, 0),
      active: domains.reduce((s, d) => s + d.active, 0),
      sessions: domains.reduce((s, d) => s + d.sessions, 0),
      lastSeen: domains.reduce((s, d) => Math.max(s, d.lastSeen), 0),
      domains,
    });
  }

  return [...apps.values()].sort((a, b) => b.seconds - a.seconds);
}

// base minus covered ranges -> the uncovered pieces (all {startMs, endMs}).
function subtractRanges(base, covers) {
  let pieces = [base];
  for (const c of covers) {
    const next = [];
    for (const p of pieces) {
      if (c.endMs <= p.startMs || c.startMs >= p.endMs) {
        next.push(p);
        continue;
      }
      if (c.startMs > p.startMs) next.push({ startMs: p.startMs, endMs: c.startMs });
      if (c.endMs < p.endMs) next.push({ startMs: c.endMs, endMs: p.endMs });
    }
    pieces = next;
  }
  return pieces;
}

/**
 * Chronological activity log for one device: one row per thing the user was
 * doing, in order.
 *   - non-browser application sessions      -> app row
 *   - browser web sessions                  -> app + domain row
 *   - browser time with no domain detected  -> "site not detected" row
 *   - idle / screen-off intervals           -> break row
 *
 * @returns {Array<{startMs:number, endMs:number, seconds:number,
 *   app:string|null, domain:string|null, status:string, tone:string}>}
 */
export function buildActivityLog(device) {
  const rows = [];

  for (const a of device?.app_sessions || []) {
    if (canonicalBrowser(a.application_name)) continue; // handled via web sessions
    rows.push({
      startMs: ms(a.started_at),
      endMs: ms(a.ended_at),
      seconds: a.duration_seconds || 0,
      app: a.application_name || "Unknown",
      domain: null,
      status: "Active",
      tone: "success",
    });
  }

  for (const w of device?.web_sessions || []) {
    const bid = (w.browser || "browser").toLowerCase();
    rows.push({
      startMs: ms(w.started_at),
      endMs: ms(w.ended_at),
      seconds: w.duration_seconds || 0,
      app: titleCase(bid),
      domain: domainLabel(w),
      status: "Active",
      tone: "success",
    });
  }

  // browser foreground time not covered by any web session (domain unknown)
  const websByBrowser = new Map();
  for (const w of device?.web_sessions || []) {
    const bid = (w.browser || "browser").toLowerCase();
    if (!websByBrowser.has(bid)) websByBrowser.set(bid, []);
    websByBrowser.get(bid).push({ startMs: ms(w.started_at), endMs: ms(w.ended_at) });
  }
  for (const a of device?.app_sessions || []) {
    const bid = canonicalBrowser(a.application_name);
    if (!bid) continue;
    const base = { startMs: ms(a.started_at), endMs: ms(a.ended_at) };
    const covers = (websByBrowser.get(bid) || [])
      .filter((c) => c.endMs > base.startMs && c.startMs < base.endMs)
      .sort((x, y) => x.startMs - y.startMs);
    for (const gap of subtractRanges(base, covers)) {
      if (gap.endMs - gap.startMs < 30000) continue; // ignore sub-30s slivers
      rows.push({
        startMs: gap.startMs,
        endMs: gap.endMs,
        seconds: Math.round((gap.endMs - gap.startMs) / 1000),
        app: titleCase(bid),
        domain: "Site not detected",
        status: "Active",
        tone: "success",
      });
    }
  }

  for (const iv of device?.intervals || []) {
    if (iv.type !== "idle" && iv.type !== "screen_off") continue;
    rows.push({
      startMs: ms(iv.started_at),
      endMs: ms(iv.ended_at),
      seconds: iv.duration_seconds || 0,
      app: null,
      domain: null,
      status:
        iv.type === "idle"
          ? "Idle"
          : SCREEN_OFF_REASON_LABEL[iv.screen_off_reason] || "Screen off",
      tone: iv.type === "idle" ? "warning" : "neutral",
    });
  }

  // Newest first — the dashboard shows the most recent activity at the top.
  return rows.sort((a, b) => b.startMs - a.startMs || b.endMs - a.endMs);
}

// Collapsed view of a list of groups/rows: the top `limit` by duration PLUS the
// `recent` most-recently-active entries not already included — so a freshly
// detected app/site is never hidden behind the "See more" cut just because it
// has little accumulated time yet. Returns entries in duration order.
export function collapseWithRecent(items, { limit = 6, recent = 3 } = {}) {
  if (items.length <= limit) return items;
  const byDuration = [...items].sort((a, b) => b.seconds - a.seconds);
  const head = byDuration.slice(0, limit);
  const keys = new Set(head.map((x) => x.key ?? x.label));
  const extras = [...items]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .filter((x) => !keys.has(x.key ?? x.label))
    .slice(0, recent);
  return [...head, ...extras].sort((a, b) => b.seconds - a.seconds);
}
