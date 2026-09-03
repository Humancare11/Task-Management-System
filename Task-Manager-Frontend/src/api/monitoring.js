import api from "./client.js";

// The dashboard reads ONLY the derived API (Phase 5). GET /monitoring/activities
// still exists on the backend as a deprecated read-only historical endpoint, but
// no UI calls it any more.

// Derived per-user daily summaries for the dashboard cards (Phase 2).
// params: { from, to, user_id, page, page_size } — all optional.
export function getMonitoringSummary(params) {
  return api.get("/monitoring/summary", { params });
}

// Full day detail for one employee (Phase 2).
// params: { user_id, date, agent_id? }
export function getMonitoringDay(params) {
  return api.get("/monitoring/daily", { params });
}

// Dashboard-driven employee enrollment. The backend derives the organization
// from the authenticated user; we only send the existing employee's user_id and
// a device name. The raw agent_secret is returned once in the response.
export function enrollEmployeeAgent({ user_id, device_name }) {
  return api.post("/monitoring/agents", { user_id, device_name });
}

// Enrolled agents (devices) for the organization. Owner/admin only.
export function listMonitoringAgents() {
  return api.get("/monitoring/agents");
}

// Revoke one agent — its credentials stop working immediately. Owner/admin only.
export function revokeMonitoringAgent(id) {
  return api.post(`/monitoring/agents/${id}/revoke`);
}

// §5b captured content for one employee + date range. Owner-only by default;
// others need an active grant. Returns 403 while the legal gate is closed — the
// caller treats any non-200 as "panel hidden". Every successful read is audited
// server-side.
// params: { user_id, from, to }
export function getMonitoringContent(params) {
  return api.get("/monitoring/content", { params });
}
