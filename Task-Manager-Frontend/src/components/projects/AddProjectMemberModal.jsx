import { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal.jsx";
import Button from "../ui/Button.jsx";
import { listOrganizationMembers } from "../../api/organizationMembers.js";
import { addProjectMember } from "../../api/projectMembers.js";
import { useToast } from "../../context/ToastContext.jsx";

// Project-member roles -- a separate vocabulary from organization roles.
const PROJECT_ROLE_OPTIONS = ["manager", "member", "viewer"];

const selectClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

export default function AddProjectMemberModal({ open, onClose, projectId, existingMembers, onAdded }) {
  const toast = useToast();
  const [orgMembers, setOrgMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("member");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setUserId("");
    setRole("member");
    listOrganizationMembers()
      .then((res) => setOrgMembers(res.data.members))
      .catch(() => setOrgMembers([]))
      .finally(() => setLoading(false));
  }, [open]);

  const availableMembers = useMemo(() => {
    const existingIds = new Set(existingMembers.map((m) => m.user_id));
    return orgMembers.filter((m) => !existingIds.has(m.user_id));
  }, [orgMembers, existingMembers]);

  function handleSubmit() {
    if (!userId) return;
    setSubmitting(true);
    addProjectMember(projectId, { user_id: Number(userId), role })
      .then(() => {
        toast.success("Member added to project.");
        onAdded();
        onClose();
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to add member.");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Member"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !userId}>
            {submitting ? "Adding..." : "Add Member"}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-txt-muted">Loading organization members...</p>
      ) : availableMembers.length === 0 ? (
        <p className="text-sm text-txt-muted">
          All organization members are already on this project.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-txt-primary">User</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selectClass}>
              <option value="">Select a user...</option>
              {availableMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.first_name} {m.last_name} — {m.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-txt-primary">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
              {PROJECT_ROLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="capitalize">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
}
