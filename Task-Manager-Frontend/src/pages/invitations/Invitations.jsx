import { useCallback, useEffect, useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import InvitationList from "../../components/invitations/InvitationList.jsx";
import InviteMemberModal from "../../components/invitations/InviteMemberModal.jsx";
import { getInvitations, resendInvitation, cancelInvitation } from "../../api/invitationApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { canManageInvitations } from "../../config/permissions.js";

export default function Invitations() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = canManageInvitations(user);

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resendTarget, setResendTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInvitations = useCallback(() => {
    setLoading(true);
    setError("");
    return getInvitations()
      .then((res) => setInvitations(res.data.invitations))
      .catch((err) => {
        if (err.response?.status === 403) {
          setError("You do not have permission to manage organization invitations.");
        } else {
          setError(err.response?.data?.message || "Unable to load invitations.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  function handleResendConfirm() {
    setActionLoading(true);
    resendInvitation(resendTarget.id)
      .then(() => {
        toast.success("Invitation resent successfully.");
        setResendTarget(null);
        return fetchInvitations();
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          toast.error("You do not have permission to manage organization invitations.");
        } else {
          toast.error(err.response?.data?.message || "Failed to resend invitation.");
        }
      })
      .finally(() => setActionLoading(false));
  }

  function handleCancelConfirm() {
    setActionLoading(true);
    cancelInvitation(cancelTarget.id)
      .then(() => {
        toast.success("Invitation cancelled successfully.");
        setCancelTarget(null);
        return fetchInvitations();
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          toast.error("You do not have permission to manage organization invitations.");
        } else {
          toast.error(err.response?.data?.message || "Failed to cancel invitation.");
        }
      })
      .finally(() => setActionLoading(false));
  }

  const inviteAction = canManage ? (
    <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>
      Invite Member
    </Button>
  ) : undefined;

  return (
    <AppLayout title="Invitations">
      <div className="space-y-6">
        <PageHeader
          title="Invitations"
          description="Manage invitations to your organization."
          actions={inviteAction}
        />

        {loading && <Spinner label="Loading invitations..." />}

        {!loading && error && <ErrorState message={error} onRetry={fetchInvitations} />}

        {!loading && !error && invitations.length === 0 && (
          <EmptyState
            icon={Mail}
            title="No invitations yet"
            description="Invite your team members to collaborate with your organization."
            action={
              canManage && (
                <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>
                  Invite Member
                </Button>
              )
            }
          />
        )}

        {!loading && !error && invitations.length > 0 && (
          <InvitationList
            invitations={invitations}
            canManage={canManage}
            onResend={setResendTarget}
            onCancel={setCancelTarget}
          />
        )}
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={fetchInvitations}
      />

      <ConfirmDialog
        open={!!resendTarget}
        onClose={() => setResendTarget(null)}
        onConfirm={handleResendConfirm}
        title="Resend Invitation?"
        description={`A new invitation will be generated for ${resendTarget?.email}.`}
        confirmLabel="Resend Invitation"
        loading={actionLoading}
        variant="primary"
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel Invitation?"
        description={`Are you sure you want to cancel the invitation for ${cancelTarget?.email}?`}
        confirmLabel="Cancel Invitation"
        cancelLabel="Keep Invitation"
        loading={actionLoading}
        variant="danger"
      />
    </AppLayout>
  );
}
