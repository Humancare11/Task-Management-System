import { Activity, Users, FolderKanban, CalendarClock } from "lucide-react";
import { formatHm } from "./monitoringUtils.js";

function Tile({ icon: Icon, label, value, hint, muted }) {
  return (
    <div className="rounded-xl border border-hair bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-txt-muted">
        <Icon size={16} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>
      <p
        className={`mt-2 text-2xl font-display font-bold ${
          muted ? "text-txt-muted" : "text-txt-primary"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-txt-muted">{hint}</p>}
    </div>
  );
}

export default function MonitoringSummary({ summary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        icon={Activity}
        label="Active Monitoring"
        value={summary.activeMonitoring}
        hint="Employees with activity in the last 15 min"
      />
      <Tile
        icon={Users}
        label="Team Members"
        value={summary.teamMembers}
        hint="Members with monitoring data in range"
      />
      {/* Monitoring records are not linked to a project in the current backend. */}
      <Tile
        icon={FolderKanban}
        label="Projects"
        value="--"
        hint="Project-level monitoring is not available yet"
        muted
      />
      <Tile
        icon={CalendarClock}
        label="Today's Activity"
        value={summary.todayActivities > 0 ? formatHm(summary.todaySeconds) : "--"}
        hint={
          summary.todayActivities > 0
            ? `${summary.todayActivities} activities recorded today`
            : "No activity recorded today"
        }
        muted={summary.todayActivities === 0}
      />
    </div>
  );
}
