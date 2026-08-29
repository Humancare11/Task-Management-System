import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import Modal from "../../components/common/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { listOrganizationMembers } from "../../api/organizationMembers.js";
import { enrollEmployeeAgent } from "../../api/monitoring.js";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

function memberName(member) {
  const name = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
  return name || member.email;
}

export default function EnrollEmployeeModal({ open, onClose, onEnrolled }) {
  const toast = useToast();

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [userId, setUserId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingMembers(true);
    listOrganizationMembers()
      .then((res) => setMembers(res.data.members || []))
      .catch(() => toast.error("Failed to load employees."))
      .finally(() => setLoadingMembers(false));
  }, [open, toast]);

  const selectedMember = useMemo(
    () => members.find((m) => String(m.user_id) === String(userId)) || null,
    [members, userId],
  );

  function resetAndClose() {
    setUserId("");
    setDeviceName("");
    setFieldError("");
    setResult(null);
    setCopied(false);
    onClose();
  }

  function handleSubmit() {
    if (!userId) {
      setFieldError("Select an employee.");
      return;
    }
    if (!deviceName.trim()) {
      setFieldError("Enter a device name.");
      return;
    }
    setFieldError("");
    setSubmitting(true);
    enrollEmployeeAgent({ user_id: Number(userId), device_name: deviceName.trim() })
      .then((res) => {
        setResult(res.data.agent);
        onEnrolled?.();
        toast.success("Monitoring agent enrolled.");
      })
      .catch((err) => {
        const status = err.response?.status;
        if (status === 403) {
          toast.error("You do not have permission to enroll monitoring agents.");
        } else if (status === 409) {
          toast.error(
            err.response?.data?.message ||
              "An active agent already exists for this employee and device.",
          );
        } else {
          toast.error(err.response?.data?.message || "Failed to enroll monitoring agent.");
        }
      })
      .finally(() => setSubmitting(false));
  }

  async function handleCopyCredentials() {
    const text = [
      `Employee: ${result.employee?.name ?? ""}`,
      `Device: ${result.device_name}`,
      `AGENT_UUID=${result.agent_uuid}`,
      `AGENT_SECRET=${result.agent_secret}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy credentials.");
    }
  }

  if (result) {
    return (
      <Modal
        open={open}
        onClose={resetAndClose}
        title="Monitoring Agent Enrolled"
        footer={<Button onClick={resetAndClose}>Done</Button>}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-ink">{result.employee?.name}</span> ·{" "}
            {result.device_name}
          </p>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Agent UUID</p>
              <p className="break-all font-mono text-sm text-ink">{result.agent_uuid}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Agent Secret</p>
              <p className="break-all font-mono text-sm text-ink">{result.agent_secret}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopyCredentials}
            >
              {copied ? "Copied!" : "Copy Credentials"}
            </Button>
          </div>

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            Copy the Agent Secret now — it is shown only once and cannot be
            retrieved later. These credentials are required to configure the
            monitoring agent on this employee's Windows computer.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Enroll Employee for Monitoring"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loadingMembers}>
            {submitting ? "Enrolling..." : "Enroll Agent"}
          </Button>
        </>
      }
    >
      {loadingMembers ? (
        <Spinner label="Loading employees..." />
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="enroll-employee" className="mb-1.5 block text-sm font-medium text-ink">
              Employee
            </label>
            <select
              id="enroll-employee"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                if (fieldError) setFieldError("");
              }}
              className={inputClass}
            >
              <option value="">Select an employee…</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {memberName(m)} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="enroll-device" className="mb-1.5 block text-sm font-medium text-ink">
              Device Name
            </label>
            <input
              id="enroll-device"
              type="text"
              value={deviceName}
              onChange={(e) => {
                setDeviceName(e.target.value);
                if (fieldError) setFieldError("");
              }}
              placeholder="e.g. Priya-Laptop"
              className={inputClass}
            />
          </div>

          {selectedMember && (
            <p className="text-xs text-slate-500">
              Enrolling {memberName(selectedMember)}'s device for activity
              monitoring in your organization.
            </p>
          )}

          {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}
        </div>
      )}
    </Modal>
  );
}
