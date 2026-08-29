import api from "./client.js";

// Dashboard read API for monitoring activities. The backend scopes results to the
// authenticated user's organization; we never send an organization id.
export function listMonitoringActivities(params) {
  return api.get("/monitoring/activities", { params });
}

// Dashboard-driven employee enrollment. The backend derives the organization
// from the authenticated user; we only send the existing employee's user_id and
// a device name. The raw agent_secret is returned once in the response.
export function enrollEmployeeAgent({ user_id, device_name }) {
  return api.post("/monitoring/agents", { user_id, device_name });
}
