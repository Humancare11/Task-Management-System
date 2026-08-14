import { UserCheck } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";

export default function MyTasks() {
  return (
    <AppLayout title="My Tasks">
      <div className="space-y-6">
        <PageHeader
          title="My Tasks"
          description="Tasks assigned to you across all projects."
        />
        <EmptyState
          icon={UserCheck}
          title="No tasks assigned to you yet."
          description="Tasks assigned to you will appear here so you can track your work."
        />
      </div>
    </AppLayout>
  );
}
