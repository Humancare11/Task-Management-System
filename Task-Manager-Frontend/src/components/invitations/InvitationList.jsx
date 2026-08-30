import InvitationRow from "./InvitationRow.jsx";
import InvitationStatusBadge from "./InvitationStatusBadge.jsx";
import Button from "../ui/Button.jsx";

const RESENDABLE = ["pending", "expired", "cancelled"];

export default function InvitationList({ invitations, canManage, onResend, onCancel }) {
  return (
    <div className="overflow-hidden rounded-xl border border-hair bg-surface-1">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="border-b border-hair bg-surface-2">
            <tr>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Email</th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Role</th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Status</th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Invited</th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Expires</th>
              {canManage && (
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                canManage={canManage}
                onResend={onResend}
                onCancel={onCancel}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-hair md:hidden">
        {invitations.map((invitation) => {
          const canResend = canManage && RESENDABLE.includes(invitation.status);
          const canCancel = canManage && invitation.status === "pending";
          return (
            <div key={invitation.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-txt-primary">{invitation.email}</p>
                  <p className="mt-0.5 text-sm capitalize text-txt-muted">{invitation.role}</p>
                </div>
                <InvitationStatusBadge status={invitation.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-txt-muted">
                <span>Invited {new Date(invitation.created_at).toLocaleDateString()}</span>
                <span>Expires {new Date(invitation.expires_at).toLocaleDateString()}</span>
              </div>
              {canManage && (canResend || canCancel) && (
                <div className="flex gap-2 pt-1">
                  {canResend && (
                    <Button variant="secondary" size="sm" onClick={() => onResend(invitation)}>
                      Resend
                    </Button>
                  )}
                  {canCancel && (
                    <Button variant="danger" size="sm" onClick={() => onCancel(invitation)}>
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
