import { Link } from "react-router-dom";
import { AlertTriangle, Flame, CalendarClock, CheckCircle2 } from "lucide-react";
import { formatShortDate } from "../../pages/tasks/myTasksUtils.js";

const REASON_META = {
  overdue: { icon: AlertTriangle, label: "Overdue", tone: "text-red-600 dark:text-red-400", ring: "border-red-500/30" },
  priority: { icon: Flame, label: "High priority", tone: "text-orange-600 dark:text-orange-400", ring: "border-orange-500/30" },
  due_soon: { icon: CalendarClock, label: "Due soon", tone: "text-amber-600 dark:text-amber-400", ring: "border-amber-500/30" },
};

export default function NeedsAttention({ items }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-txt-muted">
        Needs Attention
      </h2>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-hair bg-surface-1 px-4 py-4 text-sm text-txt-muted">
          <CheckCircle2 size={16} className="text-emerald-500" />
          You&apos;re all caught up.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.slice(0, 6).map(({ task, reason }) => {
            const meta = REASON_META[reason];
            const Icon = meta.icon;
            return (
              <Link
                key={task.id}
                to={`/projects/${task.project_id}/tasks/${task.id}`}
                className={`rounded-xl border bg-surface-1 px-4 py-3 transition-colors hover:bg-surface-2 ${meta.ring}`}
              >
                <span className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${meta.tone}`}>
                  <Icon size={13} /> {meta.label}
                </span>
                <p className="mt-1 truncate text-sm font-semibold text-txt-primary">
                  {task.title}
                </p>
                <p className="truncate text-xs text-txt-muted">
                  {task.project?.name ?? "--"}
                  {task.due_date && ` · Due ${formatShortDate(task.due_date)}`}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
