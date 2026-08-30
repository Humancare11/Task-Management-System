import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import Avatar from "../ui/Avatar.jsx";
import TaskStatusBadge from "./TaskStatusBadge.jsx";
import TaskPriorityBadge from "./TaskPriorityBadge.jsx";

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TaskRow({ task, projectId, canEdit, canDelete, onEdit, onDelete, showProject = false }) {
  return (
    <tr className="hover:bg-surface-2">
      <td className="px-6 py-4">
        <Link
          to={`/projects/${projectId ?? task.project_id}/tasks/${task.id}`}
          className="font-medium text-txt-primary hover:text-accentblue"
        >
          {task.title}
        </Link>
        {showProject && task.project && (
          <p className="mt-0.5 text-xs text-txt-muted">{task.project.name}</p>
        )}
      </td>
      <td className="px-6 py-4">
        <TaskStatusBadge status={task.status} />
      </td>
      <td className="px-6 py-4">
        <TaskPriorityBadge priority={task.priority} />
      </td>
      <td className="px-6 py-4">
        {task.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar
              firstName={task.assignee.first_name}
              lastName={task.assignee.last_name}
              avatarUrl={task.assignee.avatar_url}
              size="sm"
            />
            <span className="text-sm text-txt-muted">
              {task.assignee.first_name} {task.assignee.last_name}
            </span>
          </div>
        ) : (
          <span className="text-sm text-txt-muted">Unassigned</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm text-txt-muted">{formatDate(task.due_date)}</td>
      {(canEdit || canDelete) && (
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-1">
            {canEdit && (
              <button
                onClick={() => onEdit(task)}
                className="rounded-md p-1.5 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
                title="Edit task"
              >
                <Pencil size={16} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(task)}
                className="rounded-md p-1.5 text-txt-muted hover:bg-red-500/10 hover:text-red-600"
                title="Delete task"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
