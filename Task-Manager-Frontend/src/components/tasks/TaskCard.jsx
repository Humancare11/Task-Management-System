import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import Avatar from "../ui/Avatar.jsx";
import TaskPriorityBadge from "./TaskPriorityBadge.jsx";

function formatDueDate(value) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function TaskCard({ task, projectId }) {
  return (
    <Link
      to={`/projects/${projectId ?? task.project_id}/tasks/${task.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <TaskPriorityBadge priority={task.priority} />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Task options"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-ink">{task.title}</h3>

      {task.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{task.description}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">{formatDueDate(task.due_date)}</span>
        {task.assignee ? (
          <Avatar
            firstName={task.assignee.first_name}
            lastName={task.assignee.last_name}
            avatarUrl={task.assignee.avatar_url}
            size="sm"
          />
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
        )}
      </div>
    </Link>
  );
}
