import { FolderKanban, FolderPlus } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";

export default function Projects() {
  return (
    <AppLayout title="Projects">
      <div className="space-y-6">
        <PageHeader
          title="Projects"
          description="Track and organize your team's work."
          actions={
            <Button icon={FolderPlus} disabled title="Coming soon">
              Create Project
            </Button>
          }
        />
        <EmptyState
          icon={FolderKanban}
          title="No projects yet."
          description="Create your first project to start organizing your team's work."
        />
      </div>
    </AppLayout>
  );
}
