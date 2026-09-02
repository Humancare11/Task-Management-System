import { useEffect, useMemo, useState } from "react";
import { X, Lock, AppWindow, Globe, Moon } from "lucide-react";
import Avatar from "../../components/ui/Avatar.jsx";
import Badge from "../../components/ui/Badge.jsx";
import {
  employeeName,
  formatClock,
  formatDate,
  formatHm,
  groupByApplication,
  TYPE_META,
} from "./monitoringUtils.js";

const TYPE_ICON = { application: AppWindow, website: Globe, idle: Moon };

function Row({ label, value, muted }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs font-medium text-txt-muted">{label}</span>
      <span
        className={`text-right text-sm ${muted ? "text-txt-muted" : "text-txt-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}

function DisabledSection({ title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-hair bg-surface-2/50 p-4 opacity-70">
      <div className="flex items-center gap-2">
        <Lock size={13} className="text-txt-muted" />
        <p className="text-sm font-medium text-txt-primary">{title}</p>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-txt-muted">
          Coming soon
        </span>
      </div>
      <p className="mt-1.5 text-xs text-txt-muted">{description}</p>
    </div>
  );
}

export default function MonitoringDrawer({ group, onClose }) {
  const open = Boolean(group);
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);
  // Keep the last group during the close animation so content doesn't vanish.
  const [shown, setShown] = useState(group);

  useEffect(() => {
    if (open) {
      setShown(group);
      setShouldRender(true);
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
    const t = setTimeout(() => setShouldRender(false), 300);
    return () => clearTimeout(t);
  }, [open, group]);

  // One row per application with duration_seconds summed (Issue #3).
  const appBreakdown = useMemo(
    () => groupByApplication(shown?.activities),
    [shown],
  );

  if (!shouldRender || !shown) return null;

  const { user, status } = shown;
  const first = shown.activities[shown.activities.length - 1];
  const last = shown.activities[0];

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 top-0 flex h-screen w-full flex-col bg-surface-1 shadow-xl transition-transform duration-300 ease-in-out sm:w-[440px] ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed header */}
        <div className="flex items-start justify-between border-b border-hair px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar firstName={user?.first_name} lastName={user?.last_name} size="md" />
            <div>
              <p className="text-sm font-semibold text-txt-primary">
                Monitoring Details
              </p>
              <p className="text-xs text-txt-muted">{employeeName(user)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
              Overview
            </h3>
            <div className="divide-y divide-hair">
              {/* Monitoring is not associated with a project in the backend yet. */}
              <Row label="Project" value="Not linked" muted />
              <Row label="Member" value={employeeName(user)} />
              <Row
                label="Device"
                value={shown.deviceList.length ? shown.deviceList.join(", ") : "--"}
                muted={!shown.deviceList.length}
              />
              <Row
                label="Monitoring status"
                value={<Badge tone={status.tone}>{status.label}</Badge>}
              />
              <Row label="Date" value={formatDate(first?.started_at)} />
              <Row
                label="Time"
                value={`${formatClock(first?.started_at)} – ${formatClock(last?.ended_at)}`}
              />
              <Row label="Tracked duration" value={formatHm(shown.totalSeconds)} />
              <Row label="Active / Idle" value={`${formatHm(shown.activeSeconds)} / ${formatHm(shown.idleSeconds)}`} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
              Applications ({appBreakdown.length})
            </h3>
            {appBreakdown.length === 0 ? (
              <p className="text-xs text-txt-muted">
                No application activity in range.
              </p>
            ) : (
              <ul className="space-y-2">
                {appBreakdown.map((app) => {
                  const meta = TYPE_META[app.activityType] || TYPE_META.idle;
                  const Icon = TYPE_ICON[app.activityType] || Moon;
                  const isWebsite = app.activityType === "website";
                  return (
                    <li
                      key={app.key}
                      className={`rounded-lg border border-hair bg-surface-2/60 p-3 ${
                        isWebsite ? "ml-4" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-txt-primary">
                          <Icon size={13} className="shrink-0 text-txt-muted" />
                          <span className="truncate">{app.label}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-txt-primary">
                          {formatHm(app.totalSeconds)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="text-[11px] text-txt-muted">
                          {app.sessions}{" "}
                          {app.sessions === 1 ? "session" : "sessions"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
              Monitoring details
            </h3>
            {/* TODO: Enable when the monitoring backend exposes screenshot capture. */}
            <DisabledSection
              title="Monitoring screenshots"
              description="Screenshot monitoring is not available yet."
            />
            {/* TODO: Enable session replay when a monitoring session-replay API exists. */}
            <DisabledSection
              title="Session replay"
              description="Session replay is not available yet."
            />
            {/* TODO: Enable export once a monitoring report endpoint is available. */}
            <DisabledSection
              title="Export monitoring report"
              description="Report export is not available yet."
            />
          </section>
        </div>
      </div>
    </div>
  );
}
