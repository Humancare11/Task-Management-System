import { FolderPlus, ListPlus, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SectionCard from "../ui/SectionCard.jsx";

const actions = [
  {
    label: "Create Project",
    description: "Start organizing work into a project.",
    icon: FolderPlus,
    disabled: true,
  },
  {
    label: "Create Task",
    description: "Add a new work item to track.",
    icon: ListPlus,
    disabled: true,
  },
  {
    label: "Invite Member",
    description: "Add teammates to your organization.",
    icon: UserPlus,
    disabled: false,
    to: "/invitations",
  },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <SectionCard title="Quick Actions">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {actions.map(({ label, description, icon: Icon, disabled, to }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            title={disabled ? "Coming soon" : undefined}
            onClick={disabled ? undefined : () => navigate(to)}
            className={`flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-left transition-colors ${
              disabled
                ? "cursor-not-allowed opacity-60"
                : "hover:border-primary-200 hover:bg-primary-50/50"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
              {disabled && (
                <span className="mt-1.5 inline-block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Coming soon
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
