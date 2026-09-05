import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Power,
  AppWindow,
  Globe,
  Moon,
  Monitor,
  MonitorOff,
  Clock,
  AlertTriangle,
  ScrollText,
  Camera,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import MonitoringTimeline from "./MonitoringTimeline.jsx";
import LiveScreenViewer from "./LiveScreenViewer.jsx";
import ScreenshotCapture from "./ScreenshotCapture.jsx";
import { getMonitoringDay, getMonitoringContent } from "../../api/monitoring.js";
import {
  employeeName,
  formatClock,
  formatHm,
  formatIsoDateLong,
  isoDate,
  shiftIsoDate,
  SCREEN_OFF_REASON_LABEL,
  buildAppWebGroups,
  buildActivityLog,
  collapseWithRecent,
  deviceLiveStatus,
  overallLiveStatus,
} from "./monitoringUtils.js";

function StatTile({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="rounded-xl border border-hair bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-txt-muted">
        {Icon && <Icon size={15} />}
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">{label}</span>
      </div>
      <p
        className={`mt-1.5 text-xl font-display font-bold ${
          tone === "muted" ? "text-txt-muted" : "text-txt-primary"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-txt-muted">{hint}</p>}
    </div>
  );
}

// Live Screen tile. Click to open a real-time, peer-to-peer view of the
// employee's screen (nothing is recorded; the employee sees an on-screen
// banner). Only actionable while the device is live; the viewer surfaces
// "not enabled" / "consent missing" if the feature gate or the employee's
// consent is not in place.
function LiveScreenTile({ status, onOpen }) {
  const canView = Boolean(status?.live);
  return (
    <div className="flex flex-col rounded-xl border border-hair bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-txt-muted">
        <Monitor size={15} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Live Screen</span>
      </div>
      <button
        type="button"
        disabled={!canView}
        onClick={onOpen}
        className={`mt-1.5 flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-center text-[11px] transition-colors ${
          canView
            ? "border-accentblue/40 bg-accentblue/10 font-semibold text-accentblue hover:bg-accentblue/20"
            : "border-hair bg-surface-2/60 text-txt-muted"
        }`}
      >
        {canView ? "View live screen" : `Unavailable · ${status?.label || "Offline"}`}
      </button>
    </div>
  );
}

// Screenshot tile — a SEPARATE control from Live Screen, not nested inside it.
// Requests a single still picture of the employee's screen. It has no WebRTC
// dependency (no peer connection at all), so it works even when Live Screen's
// video cannot connect; it still needs the employee's agent online (same as
// Live Screen's initial request) to receive the capture directive at all.
function ScreenshotTile({ status, onOpen }) {
  const canCapture = Boolean(status?.live);
  return (
    <div className="flex flex-col rounded-xl border border-hair bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-txt-muted">
        <Camera size={15} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Screenshot</span>
      </div>
      <button
        type="button"
        disabled={!canCapture}
        onClick={onOpen}
        className={`mt-1.5 flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-center text-[11px] transition-colors ${
          canCapture
            ? "border-accentblue/40 bg-accentblue/10 font-semibold text-accentblue hover:bg-accentblue/20"
            : "border-hair bg-surface-2/60 text-txt-muted"
        }`}
      >
        {canCapture ? "Take screenshot" : `Unavailable · ${status?.label || "Offline"}`}
      </button>
    </div>
  );
}

function Bar({ label, seconds, total, sub, indent, icon: Icon }) {
  const pct = total > 0 ? Math.min(100, (seconds / total) * 100) : 0;
  return (
    <li className={`${indent ? "ml-5" : ""}`}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-txt-primary">
          {Icon && <Icon size={13} className="shrink-0 text-txt-muted" />}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 font-semibold text-txt-primary">{formatHm(seconds)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accentblue/70" style={{ width: `${pct}%` }} />
      </div>
      {sub && <p className="mt-0.5 text-[10px] text-txt-muted">{sub}</p>}
    </li>
  );
}

const PERIOD_LIMIT = 6;

function PeriodList({ title, icon: Icon, rows, emptyText }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, PERIOD_LIMIT);

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
        {Icon && <Icon size={13} />} {title} ({rows.length})
      </h4>
      {rows.length === 0 ? (
        <p className="text-xs text-txt-muted">{emptyText}</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {shown.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-hair bg-surface-2/50 px-3 py-2 text-xs"
              >
                <span className="text-txt-primary">
                  {formatClock(r.started_at)} – {formatClock(r.ended_at)}
                  {r.screen_off_reason && (
                    <span className="ml-2 text-txt-muted">
                      {SCREEN_OFF_REASON_LABEL[r.screen_off_reason] || r.screen_off_reason}
                    </span>
                  )}
                </span>
                <span className="font-semibold text-txt-primary">
                  {formatHm(r.duration_seconds)}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > PERIOD_LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-[11px] font-semibold text-accentblue hover:underline"
            >
              {expanded ? "See less" : `See More (${rows.length - PERIOD_LIMIT} more)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const DOMAIN_LIMIT = 6;
const APP_LIMIT = 7;
const LOG_INITIAL = 60;

const TONE_DOT = {
  success: "bg-emerald-500",
  warning: "bg-amber-400",
  neutral: "bg-slate-400",
};

// One application in the unified "Applications & Websites" list. A browser's
// per-domain rows are nested beneath it; the parent bar is the application's own
// foreground time and the child bars are a breakdown of that same time.
function AppGroup({ group, total }) {
  const [open, setOpen] = useState(false);
  const domains = group.domains || [];
  const shownDomains = open ? domains : domains.slice(0, DOMAIN_LIMIT);
  const parentTotal = group.seconds || 1;

  return (
    <li className="rounded-lg border border-hair bg-surface-2/40 px-3 py-2.5">
      <Bar
        label={group.label}
        seconds={group.seconds}
        total={total}
        icon={group.browserId ? Globe : AppWindow}
        sub={`${formatHm(group.active)} active · ${group.sessions} session${
          group.sessions === 1 ? "" : "s"
        }${group.lastSeen ? ` · last ${formatClock(group.lastSeen)}` : ""}`}
      />

      {domains.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-l border-hair pl-3">
          {shownDomains.map((d) => (
            <li key={d.label}>
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="flex min-w-0 items-center gap-1.5 text-txt-primary">
                  <span
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      d.isPrivate ? "bg-slate-400" : "bg-accentblue/70"
                    }`}
                  />
                  <span className="truncate">{d.label}</span>
                </span>
                <span className="shrink-0 text-txt-muted">
                  {formatHm(d.seconds)} · {d.sessions}x
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accentblue/50"
                  style={{
                    width: `${Math.min(100, (d.seconds / parentTotal) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
          {domains.length > DOMAIN_LIMIT && (
            <li>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-[11px] font-semibold text-accentblue hover:underline"
              >
                {open ? "Show fewer sites" : `+${domains.length - DOMAIN_LIMIT} more sites`}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

// Chronological "Activity Logs" — scrollable, built from the same daily
// response (web sessions + non-browser app sessions + idle/screen-off).
function ActivityLogPanel({ rows }) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef(null);
  // Chronological (oldest→newest). When truncated, keep the MOST RECENT slice
  // visible and let "See More" reveal earlier history.
  const shown = expanded ? rows : rows.slice(-LOG_INITIAL);

  // Land on the newest entry when the day's data (re)loads.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rows]);

  return (
    <div className="flex min-h-0 flex-col">
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
        <ScrollText size={13} /> Activity Logs ({rows.length})
      </h4>
      {rows.length === 0 ? (
        <p className="text-xs text-txt-muted">No activity recorded for this day.</p>
      ) : (
        <>
          <ol
            ref={scrollRef}
            className="max-h-[560px] space-y-1 overflow-y-auto rounded-lg border border-hair bg-surface-2/40 p-2"
          >
            {shown.map((r, i) => (
              <li
                key={`${r.startMs}-${i}`}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-surface-2"
              >
                <span
                  className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    TONE_DOT[r.tone] || "bg-slate-400"
                  }`}
                />
                <span className="w-[92px] shrink-0 font-mono text-txt-muted">
                  {formatClock(r.startMs)}
                </span>
                <span className="w-[92px] shrink-0 font-mono text-txt-muted">
                  {formatClock(r.endMs)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-txt-primary">
                    {r.app || (r.status === "Idle" ? "Idle" : r.status)}
                  </span>
                  {r.domain && (
                    <span className="text-txt-muted"> · {r.domain}</span>
                  )}
                  {r.app && r.status !== "Active" && (
                    <span className="text-txt-muted"> · {r.status}</span>
                  )}
                </span>
                <span className="shrink-0 text-txt-muted">{formatHm(r.seconds)}</span>
              </li>
            ))}
          </ol>
          {rows.length > LOG_INITIAL && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 self-start text-[11px] font-semibold text-accentblue hover:underline"
            >
              {expanded
                ? "See less"
                : `See More (${rows.length - LOG_INITIAL} earlier entries)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DeviceSection({ device, overlapNote, userId, employeeName }) {
  const pc = device.pc_session;
  const intervals = device.intervals || [];
  const live = deviceLiveStatus(device);
  const [showAllApps, setShowAllApps] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);

  // Unified Applications & Websites + chronological logs — both derived purely
  // from this device's derived sessions/intervals (no hardcoded list).
  const groups = useMemo(() => buildAppWebGroups(device), [device]);
  const activityLog = useMemo(() => buildActivityLog(device), [device]);

  const appTotal = groups.reduce((s, g) => s + g.seconds, 0) || 1;
  const shownGroups = showAllApps
    ? groups
    : collapseWithRecent(groups, { limit: APP_LIMIT, recent: 3 });

  const idleRows = intervals.filter((i) => i.type === "idle");
  const screenOffRows = intervals.filter((i) => i.type === "screen_off");
  const untrackedRows = intervals.filter((i) => i.type === "untracked");

  return (
    <section className="rounded-xl border border-hair bg-surface-1 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MonitorOff size={16} className="text-txt-muted" />
          <span className="text-sm font-semibold text-txt-primary">
            {device.agent?.device_name || "Device"}
          </span>
          {live.live && (
            <span className="relative flex h-2 w-2" title="live">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          <Badge tone={live.tone}>{live.label}</Badge>
          {live.hint && <span className="text-[11px] text-txt-muted">{live.hint}</span>}
        </div>
        <span className="text-xs text-txt-muted">
          {formatClock(pc.first_pc_on)} → {formatClock(pc.final_pc_off)}
        </span>
      </div>

      {/* timeline */}
      <MonitoringTimeline pcSession={pc} intervals={intervals} />

      {/* stat band */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile icon={Power} label="First PC on" value={formatClock(pc.first_pc_on)} />
        <StatTile
          icon={Power}
          label="Final PC off"
          value={formatClock(pc.final_pc_off)}
          hint={pc.unclean_shutdown ? "last heartbeat (unclean)" : undefined}
        />
        <StatTile icon={Clock} label="Total session" value={formatHm(pc.total_seconds)} />
        <StatTile icon={Clock} label="Active" value={formatHm(pc.active_seconds)} />
        <StatTile
          icon={Moon}
          label="Idle"
          value={formatHm(pc.idle_seconds)}
          hint={`${pc.idle_period_count} period${pc.idle_period_count === 1 ? "" : "s"}`}
        />
        <StatTile
          icon={MonitorOff}
          label="Screen off"
          value={formatHm(pc.screen_off_seconds)}
          hint={`${pc.screen_off_period_count} period${pc.screen_off_period_count === 1 ? "" : "s"}`}
        />
        {pc.untracked_seconds > 0 && (
          <StatTile
            icon={AlertTriangle}
            label="Untracked"
            value={formatHm(pc.untracked_seconds)}
            hint="agent not running"
            tone="muted"
          />
        )}
        <LiveScreenTile status={live} onOpen={() => setViewerOpen(true)} />
        <ScreenshotTile status={live} onOpen={() => setScreenshotOpen(true)} />
      </div>

      <LiveScreenViewer
        open={viewerOpen}
        targetUserId={userId}
        employeeName={employeeName}
        onClose={() => setViewerOpen(false)}
      />
      <ScreenshotCapture
        open={screenshotOpen}
        targetUserId={userId}
        employeeName={employeeName}
        onClose={() => setScreenshotOpen(false)}
      />

      {overlapNote && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          {overlapNote}
        </p>
      )}

      {/* LEFT: unified Applications & Websites   RIGHT: Activity Logs */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
            <AppWindow size={13} /> Applications &amp; Websites ({groups.length})
          </h4>
          {groups.length === 0 ? (
            <p className="text-xs text-txt-muted">No application or website activity.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {shownGroups.map((g) => (
                  <AppGroup key={g.key} group={g} total={appTotal} />
                ))}
              </ul>
              {groups.length > shownGroups.length && !showAllApps && (
                <button
                  type="button"
                  onClick={() => setShowAllApps(true)}
                  className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-accentblue hover:underline"
                >
                  <ChevronDown size={13} /> See More ({groups.length - shownGroups.length} more)
                </button>
              )}
              {showAllApps && groups.length > APP_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllApps(false)}
                  className="mt-2 text-[11px] font-semibold text-accentblue hover:underline"
                >
                  See less
                </button>
              )}
            </>
          )}
        </div>

        <ActivityLogPanel rows={activityLog} />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <PeriodList
          title="Idle periods"
          icon={Moon}
          rows={idleRows}
          emptyText="No idle periods."
        />
        <PeriodList
          title="Screen-off periods"
          icon={MonitorOff}
          rows={screenOffRows}
          emptyText="No screen-off periods."
        />
        {untrackedRows.length > 0 && (
          <PeriodList
            title="Untracked gaps"
            icon={AlertTriangle}
            rows={untrackedRows}
            emptyText="None."
          />
        )}
      </div>

      <p className="mt-4 text-[10px] text-txt-muted">
        active + idle + screen-off + untracked = {formatHm(pc.total_seconds)}
        {pc.reconciliation_delta_seconds
          ? ` (±${Math.abs(pc.reconciliation_delta_seconds)}s rounding)`
          : ""}
      </p>
    </section>
  );
}

// How often the day-detail view silently re-fetches while it is open and the
// browser tab is visible. ~30s keeps captured searches / prompts and derived
// sessions near-live without meaningfully loading the server (one viewer, a
// couple of small GETs per interval).
const AUTO_REFRESH_MS = 30 * 1000;

// §5b captured content. Renders NOTHING unless the server returns 200 — which
// only happens when the legal gate is open AND the viewer is authorized (owner
// or an active grant). A 403 / 501 / any error keeps the panel invisible. Every
// successful load is audited server-side.
function ContentPanel({ userId, date }) {
  const [state, setState] = useState({ status: "loading", items: [], via: null });

  useEffect(() => {
    let alive = true;
    // Show the loading state only on a target change, not on the poll — a silent
    // refetch must not make the panel flicker out and back in.
    setState((prev) =>
      prev.status === "ok" ? prev : { status: "loading", items: [], via: null },
    );

    const fetchOnce = () => {
      getMonitoringContent({ user_id: userId, from: date, to: date })
        .then((res) => {
          if (!alive) return;
          setState({
            status: "ok",
            items: res.data?.items || [],
            via: res.data?.access_via || null,
          });
        })
        .catch(() => {
          // Keep a panel that has already rendered; only hide if it never loaded.
          if (alive) setState((prev) => (prev.status === "ok" ? prev : { status: "hidden", items: [], via: null }));
        });
    };

    fetchOnce();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") fetchOnce();
    }, AUTO_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [userId, date]);

  if (state.status !== "ok") return null;

  return (
    <section className="rounded-xl border border-hair bg-surface-1 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-txt-primary">
          <Globe size={15} className="text-txt-muted" /> Search & prompt content
        </h3>
        <div className="flex items-center gap-2">
          {state.via === "grant" && <Badge tone="warning">via grant</Badge>}
          <span className="text-[11px] text-txt-muted">{state.items.length} entries · access logged</span>
        </div>
      </div>
      {state.items.length === 0 ? (
        <p className="text-xs text-txt-muted">No captured content for this day.</p>
      ) : (
        <ul className="space-y-1.5">
          {state.items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-hair bg-surface-2/50 px-3 py-2 text-xs"
            >
              <span className="min-w-0">
                <span className="mr-2 text-txt-muted">{formatClock(it.captured_at)}</span>
                <span className="text-txt-primary">
                  {it.undecryptable ? (
                    <em className="text-txt-muted">[unable to decrypt]</em>
                  ) : (
                    it.text
                  )}
                </span>
              </span>
              <span className="shrink-0 text-txt-muted">
                {it.kind === "prompt" ? "Prompt" : "Search"}
                {it.domain ? ` · ${it.domain}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MonitoringDayDetail() {
  const { userId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const date = searchParams.get("date") || isoDate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const setDate = useCallback(
    (next) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set("date", next);
        return p;
      });
    },
    [setSearchParams],
  );

  const load = useCallback(
    ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError("");
      return getMonitoringDay({ user_id: userId, date })
        .then((res) => setData(res.data))
        .catch((err) => {
          // A background refresh that fails leaves the last good view in place.
          if (!silent)
            setError(err.response?.data?.message || "Unable to load the day detail.");
        })
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [userId, date],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Silent auto-refresh while the tab is visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const summary = data?.summary || null;
  const devices = data?.devices || [];
  const status = overallLiveStatus(devices);
  const name = employeeName(data?.user);

  const overlapNote =
    summary && summary.multi_device && summary.overlap_seconds > 0
      ? `${formatHm(summary.overlap_seconds)} of concurrent use across ${summary.device_count} devices — per-app totals below can exceed session time.`
      : null;

  return (
    <AppLayout title="Monitoring">
      <div className="space-y-6">
        <PageHeader
          title={name}
          description={formatIsoDateLong(date)}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ArrowLeft}
                onClick={() => navigate("/monitoring")}
              >
                Back
              </Button>
              <div className="flex items-center rounded-lg border border-hair">
                <button
                  type="button"
                  aria-label="Previous day"
                  className="p-2 text-txt-muted hover:text-txt-primary"
                  onClick={() => setDate(shiftIsoDate(date, -1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="date"
                  value={date}
                  max={isoDate()}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="border-x border-hair bg-transparent px-2 py-1.5 text-xs text-txt-primary focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Next day"
                  disabled={date >= isoDate()}
                  className="p-2 text-txt-muted hover:text-txt-primary disabled:opacity-40"
                  onClick={() => setDate(shiftIsoDate(date, 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          }
        />

        {loading ? (
          <Spinner label="Loading day detail..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : devices.length === 0 ? (
          <EmptyState
            icon={MonitorOff}
            title="No monitoring data for this day"
            description={`No agent events were recorded for ${name} on ${formatIsoDateLong(date)}.`}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar
                firstName={data.user?.first_name}
                lastName={data.user?.last_name}
                size="md"
              />
              <div>
                <p className="text-sm font-semibold text-txt-primary">{name}</p>
                <p className="text-xs text-txt-muted">{data.user?.email}</p>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
              {status.hint && (
                <span className="text-[11px] text-txt-muted">{status.hint}</span>
              )}
              {summary?.multi_device && (
                <Badge tone="info">{summary.device_count} devices</Badge>
              )}
            </div>

            {/* Merged cross-device band — shown ONLY for multi-device days, where
                the union numbers differ from any single device. For a single
                device it would just duplicate that device's stat band. */}
            {summary && devices.length > 1 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatTile
                  icon={Power}
                  label="First PC on"
                  value={formatClock(summary.first_pc_on)}
                />
                <StatTile
                  icon={Power}
                  label="Final PC off"
                  value={formatClock(summary.final_pc_off)}
                />
                <StatTile
                  icon={Clock}
                  label="Total session"
                  value={formatHm(summary.span_seconds)}
                  hint={
                    summary.gap_seconds > 0
                      ? `${formatHm(summary.gap_seconds)} no device on`
                      : undefined
                  }
                />
                <StatTile icon={Clock} label="Active" value={formatHm(summary.active_seconds)} />
                <StatTile icon={Moon} label="Idle" value={formatHm(summary.idle_seconds)} />
                <StatTile
                  icon={MonitorOff}
                  label="Screen off"
                  value={formatHm(summary.screen_off_seconds)}
                />
                {summary.untracked_seconds > 0 && (
                  <StatTile
                    icon={AlertTriangle}
                    label="Untracked"
                    value={formatHm(summary.untracked_seconds)}
                    tone="muted"
                  />
                )}
                {summary.overlap_seconds > 0 && (
                  <StatTile
                    icon={AlertTriangle}
                    label="Concurrent"
                    value={formatHm(summary.overlap_seconds)}
                    hint="two devices at once"
                    tone="muted"
                  />
                )}
              </div>
            )}

            {devices.map((d) => (
              <DeviceSection
                key={d.pc_session.id}
                device={d}
                overlapNote={devices.length > 1 ? null : overlapNote}
                userId={userId}
                employeeName={name}
              />
            ))}

            <ContentPanel userId={userId} date={date} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
