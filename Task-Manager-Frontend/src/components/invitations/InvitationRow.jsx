import InvitationStatusBadge from "./InvitationStatusBadge.jsx";
import Button from "../ui/Button.jsx";

const RESENDABLE = ["pending", "expired", "cancelled"];

export default function InvitationRow({ invitation, canManage, onResend, onCancel }) {
  const canResend = canManage && RESENDABLE.includes(invitation.status);
  const canCancel = canManage && invitation.status === "pending";

  return (
    <tr className="hover:bg-surface-2">
      <td className="px-6 py-4">
        <p className="font-medium text-txt-primary">{invitation.email}</p>
      </td>
      <td className="px-6 py-4 text-sm capitalize text-txt-muted">{invitation.role}</td>
      <td className="px-6 py-4">
        <InvitationStatusBadge status={invitation.status} />
      </td>
      <td className="px-6 py-4 text-sm text-txt-muted">
        {new Date(invitation.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 text-sm text-txt-muted">
        {new Date(invitation.expires_at).toLocaleDateString()}
      </td>
      {canManage && (
        <td className="px-6 py-4 text-right">
          <div className="flex justify-end gap-2">
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
        </td>
      )}
    </tr>
  );
}
