import { Building2, Mail, ShieldCheck, UserRound } from "lucide-react";

// Read-only summary shown above the form during invitation-based registration.
//
// The current backend does not expose invitation details before the account is
// created, so every field here is optional: we render a row only when the value
// is actually available (e.g. passed through the invitation URL). Nothing is
// fabricated and none of this is trusted for authorization — the backend
// re-validates the token on submit.

function ROLE_LABEL(role) {
  if (!role) return null;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function InvitationCard({ organization, email, role, invitedBy }) {
  const rows = [
    email && { icon: Mail, label: "Invited email", value: email },
    role && { icon: ShieldCheck, label: "Role", value: ROLE_LABEL(role) },
    invitedBy && { icon: UserRound, label: "Invited by", value: invitedBy },
  ].filter(Boolean);

  return (
    <div className="mb-6 rounded-xl border border-hair bg-surface-1 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accentblue/15 text-accentblue">
          <Building2 size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-txt-muted">
            You&apos;re invited to join
          </p>
          <p className="truncate font-display text-base font-semibold text-txt-primary">
            {organization || "your team"}
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <dl className="mt-3 space-y-2 border-t border-hair pt-3">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <Icon size={14} className="shrink-0 text-txt-muted" />
              <dt className="text-txt-muted">{label}</dt>
              <dd className="ml-auto truncate font-medium text-txt-primary">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
