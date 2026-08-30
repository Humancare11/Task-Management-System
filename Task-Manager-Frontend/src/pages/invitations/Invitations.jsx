import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import InvitationList from "../../components/invitations/InvitationList.jsx";
import InviteMemberModal from "../../components/invitations/InviteMemberModal.jsx";
import { getInvitations, resendInvitation, cancelInvitation } from "../../api/invitationApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { canManageInvitations } from "../../config/permissions.js";

const ROLE_OPTIONS = ["admin", "manager", "member", "client"];
const STATUS_OPTIONS = ["pending", "accepted", "expired", "cancelled"];

const selectClass =
  "rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

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

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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

  // Client-side presentation filter only — no API/handler changes.
  const filteredInvitations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invitations.filter((invitation) => {
      if (roleFilter !== "all" && invitation.role !== roleFilter) return false;
      if (statusFilter !== "all" && invitation.status !== statusFilter) return false;
      if (!query) return true;
      return invitation.email?.toLowerCase().includes(query);
    });
  }, [invitations, search, roleFilter, statusFilter]);

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
            description="Invite a teammate to join your organization."
            action={inviteAction}
          />
        )}

        {!loading && !error && invitations.length > 0 && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invitations..."
                className="sm:max-w-xs"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role} className="capitalize">
                    {role}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status} className="capitalize">
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {filteredInvitations.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No invitations match your filters."
                description="Try a different search term, role, or status."
              />
            ) : (
              <InvitationList
                invitations={filteredInvitations}
                canManage={canManage}
                onResend={setResendTarget}
                onCancel={setCancelTarget}
              />
            )}
          </>
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
