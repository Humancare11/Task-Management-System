import { Link } from "react-router-dom";
import { formatShortDate } from "../../pages/tasks/myTasksUtils.js";

const SECTIONS = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This Week" },
  { key: "later", label: "Later" },
];

function Line({ task }) {
  return (
    <Link
      to={`/projects/${task.project_id}/tasks/${task.id}`}
      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2"
    >
      <span className="min-w-0 flex-1 truncate text-txt-primary">{task.title}</span>
      <span className="shrink-0 text-xs text-txt-muted">
        {task.project?.name ?? "--"} · {formatShortDate(task.due_date)}
      </span>
    </Link>
  );
}

export default function UpcomingTasks({ buckets }) {
  const visible = SECTIONS.filter((s) => buckets[s.key].length > 0);
  if (visible.length === 0) return null;

  return (
    <section className="rounded-xl border border-hair bg-surface-1 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-txt-muted">
        Upcoming
      </h2>
      <div className="space-y-4">
        {visible.map((s) => (
          <div key={s.key}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
              {s.label}
            </p>
            <div className="space-y-0.5">
              {buckets[s.key].map((t) => (
                <Line key={t.id} task={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
