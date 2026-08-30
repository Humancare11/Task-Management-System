import { ArrowRight, AppWindow, Globe, Clock } from "lucide-react";
import Avatar from "../../components/ui/Avatar.jsx";
import Badge from "../../components/ui/Badge.jsx";
import {
  employeeName,
  formatHm,
  formatRelative,
} from "./monitoringUtils.js";

export default function MonitoringCard({ group, onOpen }) {
  const { user, status } = group;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-3 rounded-xl border border-hair bg-surface-1 p-4 text-left transition-colors hover:border-accentblue/50 hover:bg-surface-2 focus-visible:border-accentblue"
    >
      <div className="flex items-start gap-3">
        <Avatar
          firstName={user?.first_name}
          lastName={user?.last_name}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-txt-primary">
            {employeeName(user)}
          </p>
          <p className="truncate text-xs text-txt-muted">
            {/* No project association exists on monitoring records yet. */}
            Project: <span className="text-txt-muted">--</span>
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-hair pt-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-txt-muted">
            Last activity
          </p>
          <p className="mt-0.5 text-xs text-txt-primary">
            {formatRelative(group.lastActiveAt)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-txt-muted">
            Tracked time
          </p>
          <p className="mt-0.5 text-xs text-txt-primary">
            {formatHm(group.totalSeconds)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-txt-muted">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <AppWindow size={12} /> {group.applications}
          </span>
          <span className="flex items-center gap-1">
            <Globe size={12} /> {group.websites}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} /> {formatHm(group.idleSeconds)} idle
          </span>
        </span>
        <span className="flex items-center gap-1 font-medium text-accentblue opacity-0 transition-opacity group-hover:opacity-100">
          View Details <ArrowRight size={12} />
        </span>
      </div>
    </button>
  );
}
