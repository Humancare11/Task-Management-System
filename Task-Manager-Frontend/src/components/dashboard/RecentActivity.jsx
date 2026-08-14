import EmptyState from "../common/EmptyState.jsx";
import SectionCard from "../ui/SectionCard.jsx";
import { Activity } from "lucide-react";

export default function RecentActivity() {
  return (
    <SectionCard title="Recent Activity">
      <EmptyState
        icon={Activity}
        title="No recent activity."
        description="Actions taken across your organization will show up here."
      />
    </SectionCard>
  );
}
