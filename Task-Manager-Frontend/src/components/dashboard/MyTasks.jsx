import EmptyState from "../common/EmptyState.jsx";
import SectionCard from "../ui/SectionCard.jsx";
import { ListChecks } from "lucide-react";

const columns = ["Task", "Project", "Priority", "Due Date", "Status"];

export default function MyTasks() {
  return (
    <SectionCard title="My Tasks">
      <div className="hidden border-b border-slate-100 pb-2 sm:flex">
        {columns.map((col) => (
          <span key={col} className="flex-1 text-xs font-medium text-slate-400">
            {col}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <EmptyState
          icon={ListChecks}
          title="No tasks assigned yet."
          description="Tasks assigned to you will appear here once your team starts creating them."
        />
      </div>
    </SectionCard>
  );
}
