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
// as Active; otherwise it is a completed day.
export function summaryStatus(summary) {
  if (!summary) return { label: "No data", tone: "neutral" };
  if (summary.is_provisional) return { label: "Active", tone: "success" };
  if (summary.unclean_shutdown) return { label: "Ended (unclean)", tone: "warning" };
  return { label: "Ended", tone: "neutral" };
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
