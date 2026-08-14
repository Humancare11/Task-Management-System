import EmptyState from "../common/EmptyState.jsx";
import SectionCard from "../ui/SectionCard.jsx";
import Button from "../ui/Button.jsx";
import { FolderKanban, Plus } from "lucide-react";

const columns = ["Project", "Owner", "Status", "Progress", "Updated"];

export default function ProjectOverview() {
  return (
    <SectionCard title="Recent Projects">
      <div className="hidden border-b border-slate-100 pb-2 sm:flex">
        {columns.map((col) => (
          <span key={col} className="flex-1 text-xs font-medium text-slate-400">
            {col}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <EmptyState
          icon={FolderKanban}
          title="No projects yet."
          description="Projects you create will appear here with their status and progress."
          action={
            <Button icon={Plus} size="sm" disabled title="Coming soon">
              Create Project
            </Button>
          }
        />
      </div>
    </SectionCard>
  );
}
