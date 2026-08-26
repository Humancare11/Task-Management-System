const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const {
  createMonitoringEnrollment,
  enrollMonitoringAgent,
  agentHeartbeat,
} = require("../controllers/monitoringController");

// Only organization administrators can generate monitoring enrollments
router.post(
  "/enrollments",
  requireAuth,
  requireRole("owner", "admin"),
  createMonitoringEnrollment
);

// Desktop agent enrolls itself using the one-time enrollment token (no JWT auth).
router.post("/agent/enroll", enrollMonitoringAgent);

// Desktop agent authenticates itself using agent_uuid + agent_secret (no JWT auth).
router.post("/agent/heartbeat", agentHeartbeat);

module.exports = router;
