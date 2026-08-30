import { useState } from "react";
import { Check, Copy } from "lucide-react";
import Modal from "../common/Modal.jsx";
import Button from "../ui/Button.jsx";
import { createInvitation } from "../../api/invitationApi.js";
import { useToast } from "../../context/ToastContext.jsx";

const ROLE_OPTIONS = ["admin", "manager", "member", "client"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const selectClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

const inputClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

export default function InviteMemberModal({ open, onClose, onInvited }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invitationLink, setInvitationLink] = useState(null);
  const [copied, setCopied] = useState(false);

  function resetForm() {
    setEmail("");
    setRole("member");
    setEmailError("");
    setInvitationLink(null);
    setCopied(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email is required.");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError("");
    setSubmitting(true);
    createInvitation({ email: trimmedEmail, role })
      .then((res) => {
        toast.success("Invitation sent successfully.");
        onInvited();
        if (res.data.invitation_link) {
          setInvitationLink(res.data.invitation_link);
        } else {
          handleClose();
        }
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          toast.error("You do not have permission to manage organization invitations.");
        } else {
          toast.error(err.response?.data?.message || "Failed to send invitation.");
        }
      })
      .finally(() => setSubmitting(false));
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  }

  if (invitationLink) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Invitation Created"
        footer={<Button onClick={handleClose}>Done</Button>}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-txt-primary">Invitation created successfully!</p>
            <p className="mt-1 text-sm text-txt-muted">
              Share this invitation link with the invited user:
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-hair bg-surface-2 p-2">
            <p className="min-w-0 flex-1 truncate px-1 text-sm text-txt-primary">{invitationLink}</p>
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopyLink}
              className="shrink-0"
            >
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Invite Member"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Sending..." : "Send Invitation"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="-mt-2 text-sm text-txt-muted">
          Invite a teammate to join your organization.
        </p>
        <div>
          <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium text-txt-primary">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
            }}
            placeholder="teammate@example.com"
            className={inputClass}
          />
          {emailError && <p className="mt-1.5 text-xs text-red-600">{emailError}</p>}
        </div>

        <div>
          <label htmlFor="invite-role" className="mb-1.5 block text-sm font-medium text-txt-primary">
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={selectClass}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="capitalize">
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
