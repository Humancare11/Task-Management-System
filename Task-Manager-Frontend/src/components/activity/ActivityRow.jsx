import {
  Activity as ActivityIcon,
  FolderKanban,
  CheckSquare,
  ListTodo,
  MessageSquare,
  Paperclip,
  UserPlus,
  Mail,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import Avatar from "../ui/Avatar.jsx";

// Map an activity entity_type to a lucide icon for the timeline marker.
export const ENTITY_ICONS = {
  project: FolderKanban,
  task: CheckSquare,
  subtask: ListTodo,
  comment: MessageSquare,
  attachment: Paperclip,
  member: UserPlus,
  invitation: Mail,
};

// Small overlay badge that hints at the action (created / updated / deleted).
export const ACTION_BADGES = {
  created: { Icon: Plus, className: "bg-emerald-500 text-white" },
  updated: { Icon: Pencil, className: "bg-amber-500 text-white" },
  deleted: { Icon: Trash2, className: "bg-red-500 text-white" },
};

export function formatRelativeTime(value) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const secs = Math.round(diffMs / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fullName(user) {
  if (!user) return "Someone";
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return name || user.email || "Someone";
}

export default function ActivityRow({ item }) {
  const EntityIcon = ENTITY_ICONS[item.entity_type] ?? ActivityIcon;
  const badge = ACTION_BADGES[item.action];
  const projectName = item.project?.name;
  const taskTitle = item.task?.title;

  return (
    <li className="flex items-start gap-3 px-4 py-4">
      <div className="relative shrink-0">
        <Avatar
          firstName={item.user?.first_name}
          lastName={item.user?.last_name}
          avatarUrl={item.user?.avatar_url}
          size="md"
        />
        {badge && (
          <span
            className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-surface-1 ${badge.className}`}
          >
            <badge.Icon size={10} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-txt-primary">
          <span className="font-semibold">{fullName(item.user)}</span>{" "}
          <span className="text-txt-muted">{item.description}</span>
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-txt-muted">
          <span className="inline-flex items-center gap-1">
            <EntityIcon size={12} />
            <span className="capitalize">{item.entity_type}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatRelativeTime(item.created_at)}</span>
          {projectName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <FolderKanban size={12} />
                {projectName}
              </span>
            </>
          )}
          {taskTitle && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <CheckSquare size={12} />
                {taskTitle}
              </span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
