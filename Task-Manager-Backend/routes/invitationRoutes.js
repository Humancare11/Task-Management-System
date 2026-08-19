const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const {
  createInvitation,
  getInvitations,
  cancelInvitation,
  resendInvitation,
} = require("../controllers/invitationController");

// All invitation routes require authentication
router.use(requireAuth);

// Only organization administrators can send invitations
router.post("/", requireRole("owner", "admin"), createInvitation);

// Get organization invitations
router.get("/", requireRole("owner", "admin"), getInvitations);

// Cancel invitation
router.delete("/:id", requireRole("owner", "admin"), cancelInvitation);

// Resend invitation
router.post("/:id/resend", requireRole("owner", "admin"), resendInvitation);

module.exports = router;
