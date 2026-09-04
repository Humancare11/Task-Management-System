const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const {
  enrollEmployeeAgent,
  listMonitoringAgents,
  revokeMonitoringAgent,
  agentHeartbeat,
  submitMonitoringActivities,
  submitMonitoringEvents,
  getMonitoringActivities,
  getMonitoringSummary,
  getMonitoringDaily,
  triggerMonitoringRecompute,
  getMonitoringConsentStatus,
  submitAgentConsent,
  submitMonitoringContent,
  getMonitoringContent,
} = require("../controllers/monitoringController");

// The raw-event ingest can post batches larger than the global 100kb JSON
// limit. It gets its own parser with a higher cap here; index.js skips the
// global parser for exactly this path so this one runs.
const eventsJsonParser = express.json({
  limit: process.env.MONITORING_EVENTS_BODY_LIMIT || "5mb",
});

// §5b content ingest — small text payloads, but batched. Own parser + a global
// skip in index.js, same pattern as the events ingest.
const contentJsonParser = express.json({
  limit: process.env.MONITORING_CONTENT_BODY_LIMIT || "1mb",
});

// Phase 5: the token-based self-enrollment flow (POST /enrollments +
// POST /agent/enroll) is removed — it was never used by the agent, which is
// enrolled dashboard-side via POST /agents (below) and gets its credentials
// directly. The monitoring_enrollments table is left in place, unused.

// Dashboard-driven employee enrollment: owner/admin enrolls an existing
// employee's device and receives the agent credentials once.
router.post(
  "/agents",
  requireAuth,
  requireRole("owner", "admin"),
  enrollEmployeeAgent
);

// Owner/admin: list enrolled agents (devices) for the organization, and revoke
// one. Revoking flips status -> 'revoked'; the agent's next call gets 401.
router.get(
  "/agents",
  requireAuth,
  requireRole("owner", "admin"),
  listMonitoringAgents
);
router.post(
  "/agents/:id/revoke",
  requireAuth,
  requireRole("owner", "admin"),
  revokeMonitoringAgent
);

// Desktop agent authenticates itself using agent_uuid + agent_secret (no JWT auth).
router.post("/agent/heartbeat", agentHeartbeat);

// DEPRECATED (Phase 5) — legacy activity ingest. Kept mounted so a reverted
// agent (PIPELINE_MODE=legacy|dual) still works; the default agent no longer
// writes here. Responses carry Deprecation / Sunset headers.
router.post("/agent/activities", submitMonitoringActivities);

// Desktop agent submits a batch of raw events (no JWT auth). Route-specific
// body parser (see eventsJsonParser above).
router.post("/agent/events", eventsJsonParser, submitMonitoringEvents);

// Desktop agent records the employee's consent acceptance (no JWT auth). NOT
// gated by the legal flag — consent rows must exist before it is flipped.
router.post("/agent/consent", submitAgentConsent);

// Desktop agent submits captured content (no JWT auth). Returns 501 while the
// legal gate is closed. Route-specific body parser.
router.post("/agent/content", contentJsonParser, submitMonitoringContent);

// DEPRECATED (Phase 5) — read-only historical access to monitoring_activities.
// The dashboard reads /summary + /daily. Owner/admin only. Responses carry
// Deprecation / Sunset headers.
router.get(
  "/activities",
  requireAuth,
  requireRole("owner", "admin"),
  getMonitoringActivities
);

// Derived read API (Phase 2). Owner/admin, organization-scoped.
router.get(
  "/summary",
  requireAuth,
  requireRole("owner", "admin"),
  getMonitoringSummary
);
router.get(
  "/daily",
  requireAuth,
  requireRole("owner", "admin"),
  getMonitoringDaily
);

// Manual derivation trigger + queue/runner diagnostics. Owner/admin. Recovery
// for hosts that suspend the background timer.
router.post(
  "/recompute",
  requireAuth,
  requireRole("owner", "admin"),
  triggerMonitoringRecompute
);

// §5b consent status — which monitored users have accepted the current consent
// document, and the checklist of what remains before capture can run. Owner/admin,
// read-only.
router.get(
  "/consents",
  requireAuth,
  requireRole("owner", "admin"),
  getMonitoringConsentStatus
);

// §5b captured content read. Owner-only by default; a non-owner is allowed only
// via an active monitoring_content_grants row (checked in the controller). Every
// read writes an audit row first. 403 while the legal gate is closed. No
// requireRole here on purpose — a granted non-admin reviewer is valid.
router.get("/content", requireAuth, getMonitoringContent);

module.exports = router;
