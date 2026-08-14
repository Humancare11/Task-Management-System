import { Activity as ActivityIcon } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";

export default function Activity() {
  return (
    <AppLayout title="Activity">
      <div className="space-y-6">
        <PageHeader
          title="Activity"
          description="A timeline of actions taken across your organization."
        />
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet."
          description="Recent actions across your organization will appear here."
        />
      </div>
    </AppLayout>
  );
}
