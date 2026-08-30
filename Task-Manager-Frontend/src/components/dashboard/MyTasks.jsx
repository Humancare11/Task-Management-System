import { Link } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import TaskStatusBadge from "../tasks/TaskStatusBadge.jsx";
import TaskPriorityBadge from "../tasks/TaskPriorityBadge.jsx";

const columns = ["Task", "Project", "Priority", "Due", "Status"];
const PREVIEW_COUNT = 5;

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyTasks({ tasks = [], loading = false, error = "" }) {
  // Backend returns assigned tasks ordered by due date ascending.
  const preview = tasks.slice(0, PREVIEW_COUNT);

  return (
    <section className="flex flex-col rounded-xl border-[0.5px] border-hair bg-surface-1">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-txt-primary">My tasks</h2>
        <Link
          to="/my-tasks"
          className="text-[11px] font-medium text-accentblue hover:text-accentblue-icon"
        >
          View all
        </Link>
      </div>

      <div className="hidden grid-cols-5 gap-3 border-t-[0.5px] border-hair px-4 py-2 sm:grid">
        {columns.map((col) => (
          <span
            key={col}
            className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-txt-muted"
          >
            {col}
          </span>
        ))}
      </div>

      {loading && (
        <p className="flex-1 border-t-[0.5px] border-hair px-4 py-10 text-center text-sm text-txt-muted">
          Loading tasks…
        </p>
      )}

      {!loading && error && (
        <p className="flex-1 border-t-[0.5px] border-hair px-4 py-10 text-center text-sm text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && preview.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border-t-[0.5px] border-hair px-6 py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-txt-muted">
            <CheckSquare size={18} />
          </span>
          <p className="text-sm text-txt-muted">No tasks assigned yet</p>
        </div>
      )}

      {!loading && !error && preview.length > 0 && (
        <ul className="flex-1 divide-y-[0.5px] divide-hair border-t-[0.5px] border-hair">
          {preview.map((task) => (
            <li
              key={task.id}
              className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm sm:grid-cols-5 sm:items-center"
            >
              <Link
                to={`/projects/${task.project_id}/tasks/${task.id}`}
                className="col-span-2 truncate font-medium text-txt-primary hover:text-accentblue sm:col-span-1"
              >
                {task.title}
              </Link>
              <span className="truncate text-txt-muted">
                {task.project?.name ?? "--"}
              </span>
              <span>
                <TaskPriorityBadge priority={task.priority} />
              </span>
              <span className="text-txt-muted">{formatDate(task.due_date)}</span>
              <span>
                <TaskStatusBadge status={task.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
