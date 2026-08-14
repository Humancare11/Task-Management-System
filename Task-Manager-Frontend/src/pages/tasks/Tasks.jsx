import { ListChecks, ListPlus } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";

export default function Tasks() {
  return (
    <AppLayout title="Tasks">
      <div className="space-y-6">
        <PageHeader
          title="Tasks"
          description="All tasks across your organization's projects."
          actions={
            <Button icon={ListPlus} disabled title="Coming soon">
              Create Task
            </Button>
          }
        />
        <EmptyState
          icon={ListChecks}
          title="No tasks yet."
          description="Tasks created across your organization's projects will show up here."
        />
      </div>
    </AppLayout>
  );
}
