const crypto = require("crypto");
const { OrganizationInvitation, User } = require("../models");

// POST /api/invitations
exports.createInvitation = async (req, res) => {
  try {
    const { email, role = "member" } = req.body;

    const allowedRoles = ["admin", "manager", "member", "client"];

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid invitation role.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check whether the user already exists
    const existingUser = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message:
          "A user with this email already exists. They cannot be invited again.",
      });
    }

    // Check for an existing pending invitation
    const existingInvitation = await OrganizationInvitation.findOne({
      where: {
        organization_id: req.user.organization_id,
        email: normalizedEmail,
        status: "pending",
      },
    });

    if (existingInvitation) {
      return res.status(409).json({
        message: "A pending invitation already exists for this email.",
      });
    }

    // Generate secure invitation token
    const token = crypto.randomBytes(32).toString("hex");

    // Invitation expires after 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await OrganizationInvitation.create({
      organization_id: req.user.organization_id,
      email: normalizedEmail,
      role,
      token,
      invited_by: req.user.id,
      status: "pending",
      expires_at: expiresAt,
    });

    return res.status(201).json({
      message: "Invitation created successfully.",
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error("Create invitation error:", error);

    return res.status(500).json({
      message: "Server error while creating invitation.",
    });
  }
};

// GET /api/invitations
exports.getInvitations = async (req, res) => {
  try {
    const invitations = await OrganizationInvitation.findAll({
      where: {
        organization_id: req.user.organization_id,
      },

      attributes: [
        "id",
        "organization_id",
        "email",
        "role",
        "invited_by",
        "status",
        "expires_at",
        "accepted_at",
        "created_at",
        "updated_at",
      ],

      order: [["created_at", "DESC"]],
    });

    return res.json({
      invitations,
    });
  } catch (error) {
    console.error("Get invitations error:", error);

    return res.status(500).json({
      message: "Server error while fetching invitations.",
    });
  }
};

// DELETE /api/invitations/:id
exports.cancelInvitation = async (req, res) => {
  try {
    const invitation = await OrganizationInvitation.findOne({
      where: {
        id: req.params.id,
        organization_id: req.user.organization_id,
      },
    });

    if (!invitation) {
      return res.status(404).json({
        message: "Invitation not found.",
      });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({
        message: "Only pending invitations can be cancelled.",
      });
    }

    invitation.status = "cancelled";

    await invitation.save();

    return res.json({
      message: "Invitation cancelled successfully.",
    });
  } catch (error) {
    console.error("Cancel invitation error:", error);

    return res.status(500).json({
      message: "Server error while cancelling invitation.",
    });
  }
};

// POST /api/invitations/:id/resend
exports.resendInvitation = async (req, res) => {
  try {
    const invitation = await OrganizationInvitation.findOne({
      where: {
        id: req.params.id,
        organization_id: req.user.organization_id,
      },
    });

    if (!invitation) {
      return res.status(404).json({
        message: "Invitation not found.",
      });
    }

    if (invitation.status === "accepted") {
      return res.status(400).json({
        message: "This invitation has already been accepted.",
      });
    }

    // Generate a new secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Extend expiration by 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    invitation.token = token;
    invitation.status = "pending";
    invitation.expires_at = expiresAt;
    invitation.accepted_at = null;

    await invitation.save();

    return res.json({
      message: "Invitation resent successfully.",
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error("Resend invitation error:", error);

    return res.status(500).json({
      message: "Server error while resending invitation.",
    });
  }
};
