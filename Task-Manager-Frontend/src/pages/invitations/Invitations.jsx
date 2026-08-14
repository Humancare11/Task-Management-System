import { Mail, UserPlus } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";

export default function Invitations() {
  return (
    <AppLayout title="Invitations">
      <div className="space-y-6">
        <PageHeader
          title="Invitations"
          description="Invite teammates and track pending invitations."
          actions={
            <Button icon={UserPlus} disabled title="Coming soon">
              Invite Member
            </Button>
          }
        />
        <EmptyState
          icon={Mail}
          title="No pending invitations."
          description="Invite teammates to your organization and track their status here."
        />
      </div>
    </AppLayout>
  );
}
