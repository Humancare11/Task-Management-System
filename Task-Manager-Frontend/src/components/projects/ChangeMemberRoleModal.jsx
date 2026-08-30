import { useEffect, useState } from "react";
import Modal from "../common/Modal.jsx";
import Button from "../ui/Button.jsx";
import { updateProjectMemberRole } from "../../api/projectMembers.js";
import { useToast } from "../../context/ToastContext.jsx";

// Project-member roles -- a separate vocabulary from organization roles.
const PROJECT_ROLE_OPTIONS = ["manager", "member", "viewer"];

const selectClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

export default function ChangeMemberRoleModal({ open, onClose, projectId, member, onChanged }) {
  const toast = useToast();
  const [role, setRole] = useState("member");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && member) setRole(member.role);
  }, [open, member]);

  function handleSubmit() {
    setSubmitting(true);
    updateProjectMemberRole(projectId, member.user_id, role)
      .then(() => {
        toast.success("Member role updated.");
        onChanged();
        onClose();
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to update member role.");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Role"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-txt-primary">
          Role for {member?.user?.first_name} {member?.user?.last_name}
        </label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
          {PROJECT_ROLE_OPTIONS.map((opt) => (
            <option key={opt} value={opt} className="capitalize">
              {opt}
            </option>
          ))}
        </select>
      </div>
    </Modal>
  );
}
