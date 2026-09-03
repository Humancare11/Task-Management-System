import { useCallback, useEffect, useState } from "react";
import { MonitorSmartphone, ShieldOff } from "lucide-react";
import Drawer from "../../components/ui/Drawer.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { listMonitoringAgents, revokeMonitoringAgent } from "../../api/monitoring.js";
import { employeeName, formatDateTime, formatRelative } from "./monitoringUtils.js";

// Owner/admin device management: list every enrolled agent and revoke one.
// Revoking flips the agent to `revoked` server-side; its next heartbeat /
// events call gets 401, so the desktop agent clears its stored credentials.
export default function ManageDevicesModal({ open, onClose, onChanged }) {
  const toast = useToast();

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingRevoke, setPendingRevoke] = useState(null); // agent row
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listMonitoringAgents()
      .then((res) => setAgents(res.data.agents || []))
      .catch((err) =>
        setError(err.response?.data?.message || "Unable to load devices."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function handleRevoke() {
    if (!pendingRevoke) return;
    setRevoking(true);
    revokeMonitoringAgent(pendingRevoke.id)
      .then(() => {
        toast.success(`Revoked "${pendingRevoke.device_name}".`);
        setPendingRevoke(null);
        load();
        onChanged?.();
      })
      .catch((err) => {
        const status = err.response?.status;
        if (status === 403) toast.error("You do not have permission to revoke devices.");
        else toast.error(err.response?.data?.message || "Failed to revoke device.");
      })
      .finally(() => setRevoking(false));
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Manage Devices"
        description="Every monitoring agent enrolled in your organization."
        footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
      >
        {loading ? (
          <Spinner label="Loading devices..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : agents.length === 0 ? (
          <EmptyState
            icon={MonitorSmartphone}
            title="No devices enrolled"
            description="Use “Add Employee” to enroll an employee's computer."
          />
        ) : (
          <ul className="space-y-3">
            {agents.map((a) => {
              const revoked = a.status === "revoked";
              const lastBeat = a.last_heartbeat_at || a.last_seen_at;
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-hair bg-surface-1 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-txt-primary">
                          {a.device_name}
                        </span>
                        <Badge tone={revoked ? "neutral" : "success"}>
                          {revoked ? "Revoked" : "Active"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-txt-muted">
                        {employeeName(a.user)} · {a.platform}
                        {a.agent_version ? ` · v${a.agent_version}` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-txt-muted">
                        {lastBeat
                          ? `Last heartbeat ${formatRelative(lastBeat)} (${formatDateTime(lastBeat)})`
                          : "No heartbeat yet"}
                      </p>
                    </div>
                    {!revoked && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={ShieldOff}
                        onClick={() => setPendingRevoke(a)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(pendingRevoke)}
        onClose={() => (revoking ? null : setPendingRevoke(null))}
        onConfirm={handleRevoke}
        loading={revoking}
        title="Revoke this device?"
        confirmLabel="Revoke"
        description={
          pendingRevoke
            ? `"${pendingRevoke.device_name}" (${employeeName(pendingRevoke.user)}) will stop being able to report. Data already collected is kept. Re-enrolling needs a new agent secret.`
            : ""
        }
      />
    </>
  );
}
