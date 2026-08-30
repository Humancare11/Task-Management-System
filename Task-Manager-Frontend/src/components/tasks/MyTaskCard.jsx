import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import TaskStatusBadge from "./TaskStatusBadge.jsx";
import TaskPriorityBadge from "./TaskPriorityBadge.jsx";
import { dueState, formatShortDate } from "../../pages/tasks/myTasksUtils.js";

const DUE_TONE = {
  overdue: "text-red-600 dark:text-red-400",
  due_soon: "text-amber-600 dark:text-amber-400",
  normal: "text-txt-muted",
  none: "text-txt-muted",
  done: "text-txt-muted",
};

function DueLabel({ task }) {
  const d = dueState(task);
  if (d.key === "done") {
    return (
      <span className="flex items-center gap-1 text-xs text-txt-muted">
        <CheckCircle2 size={13} /> Completed
      </span>
    );
  }
  if (d.key === "none") return <span className="text-xs text-txt-muted">No due date</span>;
  if (d.key === "normal") {
    return <span className="text-xs text-txt-muted">Due {formatShortDate(d.date)}</span>;
  }
  return (
    <span className={`flex flex-col text-xs font-medium ${DUE_TONE[d.key]}`}>
      {d.label}
      <span className="font-normal">{formatShortDate(d.date)}</span>
    </span>
  );
}

export default function MyTaskCard({ task }) {
  const completed = task.status === "completed";

  return (
    <Link
      to={`/projects/${task.project_id}/tasks/${task.id}`}
      className={`group flex items-center gap-4 rounded-xl border border-hair bg-surface-1 px-4 py-3 transition-colors hover:border-accentblue/50 hover:bg-surface-2 ${
        completed ? "opacity-70" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TaskPriorityBadge priority={task.priority} />
          <p
            className={`truncate text-sm font-semibold text-txt-primary ${
              completed ? "line-through decoration-txt-muted" : ""
            }`}
          >
            {task.title}
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs text-txt-muted">
          {task.project?.name ?? "--"}
        </p>
      </div>

      <div className="hidden shrink-0 sm:block">
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="hidden w-24 shrink-0 text-right sm:block">
        <DueLabel task={task} />
      </div>

      <ArrowRight
        size={15}
        className="shrink-0 text-txt-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accentblue"
      />
    </Link>
  );
}
