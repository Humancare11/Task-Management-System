import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Power,
  AppWindow,
  Globe,
  Moon,
  MonitorOff,
  Clock,
  AlertTriangle,
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
import { getMonitoringDay, getMonitoringContent } from "../../api/monitoring.js";
import {
  employeeName,
  formatClock,
  formatHm,
  formatIsoDateLong,
  isoDate,
  shiftIsoDate,
  summaryStatus,
  INTERVAL_META,
  SCREEN_OFF_REASON_LABEL,
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

function PeriodList({ title, icon: Icon, rows, emptyText }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
        {Icon && <Icon size={13} />} {title} ({rows.length})
      </h4>
      {rows.length === 0 ? (
        <p className="text-xs text-txt-muted">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
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
              <span className="font-semibold text-txt-primary">{formatHm(r.duration_seconds)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeviceSection({ device, overlapNote }) {
  const pc = device.pc_session;
  const intervals = device.intervals || [];

  const appAgg = useMemo(() => {
    const map = new Map();
    for (const a of device.app_sessions || []) {
      const k = a.application_name || "Unknown";
      const e = map.get(k) || { label: k, seconds: 0, active: 0, sessions: 0 };
      e.seconds += a.duration_seconds;
      e.active += a.active_seconds;
      e.sessions += 1;
      map.set(k, e);
    }
    return [...map.values()].sort((x, y) => y.seconds - x.seconds);
  }, [device.app_sessions]);

  const webAgg = useMemo(() => {
    const byBrowser = new Map();
    for (const w of device.web_sessions || []) {
      const b = w.browser || "browser";
      if (!byBrowser.has(b)) byBrowser.set(b, new Map());
      const key = w.is_private ? "Private Browsing" : w.domain || "Unknown";
      const m = byBrowser.get(b);
      const e = m.get(key) || { label: key, seconds: 0, sessions: 0, isPrivate: w.is_private };
      e.seconds += w.duration_seconds;
      e.sessions += 1;
      m.set(key, e);
    }
    return [...byBrowser.entries()].map(([browser, m]) => ({
      browser,
      rows: [...m.values()].sort((x, y) => y.seconds - x.seconds),
    }));
  }, [device.web_sessions]);

  const idleRows = intervals.filter((i) => i.type === "idle");
  const screenOffRows = intervals.filter((i) => i.type === "screen_off");
  const untrackedRows = intervals.filter((i) => i.type === "untracked");
  const totalForBars = pc.active_seconds + pc.idle_seconds || 1;
  const appTotal = appAgg.reduce((s, a) => s + a.seconds, 0) || 1;

  return (
    <section className="rounded-xl border border-hair bg-surface-1 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MonitorOff size={16} className="text-txt-muted" />
          <span className="text-sm font-semibold text-txt-primary">
            {device.agent?.device_name || "Device"}
          </span>
          {pc.is_provisional && <Badge tone="info">Live</Badge>}
          {pc.unclean_shutdown && (
            <Badge tone="warning">
              <AlertTriangle size={11} className="mr-1" />
              Unclean shutdown
            </Badge>
          )}
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
      </div>

      {overlapNote && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          {overlapNote}
        </p>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
            <AppWindow size={13} /> Applications ({appAgg.length})
          </h4>
          {appAgg.length === 0 ? (
            <p className="text-xs text-txt-muted">No application activity.</p>
          ) : (
            <ul className="space-y-2.5">
              {appAgg.map((a) => (
                <Bar
                  key={a.label}
                  label={a.label}
                  seconds={a.seconds}
                  total={appTotal}
                  sub={`${formatHm(a.active)} active · ${a.sessions} session${a.sessions === 1 ? "" : "s"}`}
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
            <Globe size={13} /> Websites
          </h4>
          {webAgg.length === 0 ? (
            <p className="text-xs text-txt-muted">No website activity.</p>
          ) : (
            <div className="space-y-3">
              {webAgg.map(({ browser, rows }) => {
                const bt = rows.reduce((s, r) => s + r.seconds, 0) || 1;
                return (
                  <div key={browser}>
                    <p className="mb-1 text-[11px] font-semibold capitalize text-txt-muted">
                      {browser}
                    </p>
                    <ul className="space-y-2">
                      {rows.map((r) => (
                        <Bar
                          key={r.label}
                          label={r.label}
                          seconds={r.seconds}
                          total={bt}
                          indent
                          sub={`${r.sessions} session${r.sessions === 1 ? "" : "s"}`}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
  const status = summaryStatus(summary);
  const devices = data?.devices || [];
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
              {summary?.multi_device && (
                <Badge tone="info">{summary.device_count} devices</Badge>
              )}
            </div>

            {/* merged summary band (only meaningful with >1 device; still shown for context) */}
            {summary && (
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
              />
            ))}

            <ContentPanel userId={userId} date={date} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
