import { ArrowRight, AppWindow, Globe, Clock, Moon, MonitorOff, AlertTriangle } from "lucide-react";
import Avatar from "../../components/ui/Avatar.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { employeeName, formatClock, formatHm, summaryStatus } from "./monitoringUtils.js";

// One card per employee for the selected day, from a monitoring_user_day_summaries
// row. Clicking opens the full day-detail page.
export default function MonitoringCard({ summary, onOpen }) {
  const status = summaryStatus(summary);
  const topApp = (summary.top_apps || [])[0];
  const topDomain = (summary.top_domains || [])[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-3 rounded-xl border border-hair bg-surface-1 p-4 text-left transition-colors hover:border-accentblue/50 hover:bg-surface-2 focus-visible:border-accentblue"
    >
      <div className="flex items-start gap-3">
        <Avatar
          firstName={summary.user?.first_name}
          lastName={summary.user?.last_name}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-txt-primary">
            {employeeName(summary.user)}
          </p>
          <p className="truncate text-xs text-txt-muted">
            {formatClock(summary.first_pc_on)} – {formatClock(summary.final_pc_off)}
            {summary.multi_device ? ` · ${summary.device_count} devices` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={status.tone}>{status.label}</Badge>
          {summary.unclean_shutdown && !summary.is_provisional && (
            <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle size={10} /> unclean
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-hair pt-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-txt-muted">
            Session
          </p>
          <p className="mt-0.5 text-xs text-txt-primary">{formatHm(summary.span_seconds)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-txt-muted">
            Active
          </p>
          <p className="mt-0.5 text-xs text-txt-primary">{formatHm(summary.active_seconds)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-txt-muted">
            Idle
          </p>
          <p className="mt-0.5 text-xs text-txt-primary">{formatHm(summary.idle_seconds)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-txt-muted">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex items-center gap-1">
            <MonitorOff size={12} /> {formatHm(summary.screen_off_seconds)}
          </span>
          {topApp && (
            <span className="flex min-w-0 items-center gap-1">
              <AppWindow size={12} />
              <span className="truncate">{topApp.name}</span>
            </span>
          )}
          {topDomain && !topDomain.is_private && (
            <span className="flex min-w-0 items-center gap-1">
              <Globe size={12} />
              <span className="truncate">{topDomain.domain}</span>
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 font-medium text-accentblue opacity-0 transition-opacity group-hover:opacity-100">
          View Details <ArrowRight size={12} />
        </span>
      </div>

      {summary.overlap_seconds > 0 && (
        <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
          <Clock size={10} /> {formatHm(summary.overlap_seconds)} concurrent across devices
        </p>
      )}
    </button>
  );
}
