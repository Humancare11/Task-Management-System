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
      className="block rounded-2xl border border-hair bg-surface-3 p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <TaskPriorityBadge priority={task.priority} />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="rounded-md p-1 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
          aria-label="Task options"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-txt-primary">{task.title}</h3>

      {task.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-txt-muted">{task.description}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-hair pt-3">
        <span className="text-xs text-txt-muted">{formatDueDate(task.due_date)}</span>
        {task.assignee ? (
          <Avatar
            firstName={task.assignee.first_name}
            lastName={task.assignee.last_name}
            avatarUrl={task.assignee.avatar_url}
            size="sm"
          />
        ) : (
          <span className="text-xs text-txt-muted">Unassigned</span>
        )}
      </div>
    </Link>
  );
}
