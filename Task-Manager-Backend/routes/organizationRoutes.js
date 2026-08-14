const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");
const {
  getMembers,
  createInvitation,
  getInvitations,
  acceptInvitation,
} = require("../controllers/organizationController");

router.get("/members", requireAuth, getMembers);
router.post(
  "/invitations",
  requireAuth,
  createInvitation
);
router.get(
  "/invitations",
  requireAuth,
  getInvitations
);
router.post(
  "/invitations/:token/accept",
  requireAuth,
  acceptInvitation
);
module.exports = router;