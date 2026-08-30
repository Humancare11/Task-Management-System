const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const {
  createMonitoringEnrollment,
  enrollEmployeeAgent,
  enrollMonitoringAgent,
  agentHeartbeat,
  submitMonitoringActivities,
  getMonitoringActivities,
} = require("../controllers/monitoringController");

// Only organization administrators can generate monitoring enrollments
router.post(
  "/enrollments",
  requireAuth,
  requireRole("owner", "admin"),
  createMonitoringEnrollment
);

// Dashboard-driven employee enrollment: owner/admin enrolls an existing
// employee's device and receives the agent credentials once.
router.post(
  "/agents",
  requireAuth,
  requireRole("owner", "admin"),
  enrollEmployeeAgent
);

// Desktop agent enrolls itself using the one-time enrollment token (no JWT auth).
router.post("/agent/enroll", enrollMonitoringAgent);

// Desktop agent authenticates itself using agent_uuid + agent_secret (no JWT auth).
router.post("/agent/heartbeat", agentHeartbeat);

// Desktop agent submits a batch of collected activities (no JWT auth).
router.post("/agent/activities", submitMonitoringActivities);

// Dashboard retrieves monitoring activities for the authenticated user's organization.
// Monitoring data is owner/admin only (same as the enrollment endpoints above).
router.get(
  "/activities",
  requireAuth,
  requireRole("owner", "admin"),
  getMonitoringActivities
);

module.exports = router;
