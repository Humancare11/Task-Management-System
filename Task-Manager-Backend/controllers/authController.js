const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Organization, AuthIdentity, OrganizationMember, OrganizationInvitation } = require("../models");
const { sequelize } = require("../config/db");
const { createActivity } = require("../utils/activity");

function generateToken({ user, organizationId, role }) {
  return jwt.sign(
    { id: user.id, organization_id: organizationId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// POST /api/auth/register
// Creates a new organization (company) and its first user as "owner".
exports.register = async (req, res) => {
  try {
    const { company_name, first_name, last_name, email, password } = req.body;

    if (!company_name || !first_name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use." });
    }

    const slug =
      company_name.toLowerCase().trim().replace(/\s+/g, "-") + "-" + Date.now();

    const organization = await Organization.create({ name: company_name, slug });

    const user = await User.create({
      first_name,
      last_name,
      email,
    });

    const password_hash = await bcrypt.hash(password, 10);

    await AuthIdentity.create({
      user_id: user.id,
      provider: "local",
      password_hash,
    });

    const membership = await OrganizationMember.create({
      organization_id: organization.id,
      user_id: user.id,
      role: "owner",
    });

    const token = generateToken({
      user,
      organizationId: organization.id,
      role: membership.role,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: membership.role,
        organization_id: organization.id,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during registration." });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const authIdentity = await AuthIdentity.findOne({
      where: { user_id: user.id, provider: "local" },
    });
    if (!authIdentity || !authIdentity.password_hash) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, authIdentity.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // NOTE: assumes one org per user for now (first membership found).
    // If/when users can belong to multiple orgs, this needs a different
    // strategy (e.g. an org switcher, or a "primary org" flag).
    const membership = await OrganizationMember.findOne({
      where: { user_id: user.id, is_active: true },
    });
    if (!membership) {
      return res.status(403).json({ message: "No active organization membership found." });
    }

    user.last_login_at = new Date();
    await user.save();

    const token = generateToken({
      user,
      organizationId: membership.organization_id,
      role: membership.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: membership.role,
        organization_id: membership.organization_id,
      },
    });
} catch (error) {
  console.error("LOGIN ERROR:", error);
  console.error("SQL MESSAGE:", error.original?.sqlMessage);
  console.error("SQL:", error.sql);

  res.status(500).json({ message: "Server error during login." });
}
};

// GET /api/auth/google/callback
// Called by Passport after Google auth succeeds. req.user is set by passport.
exports.googleCallback = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  try {
    const user = req.user;

    const membership = await OrganizationMember.findOne({
      where: { user_id: user.id, is_active: true },
    });

    if (!membership) {
      return res.redirect(`${frontendUrl}/login?error=no_membership`);
    }

    const token = generateToken({
      user,
      organizationId: membership.organization_id,
      role: membership.role,
    });

    // Redirect back to frontend with the token as a query param.
    // Frontend catches this on a dedicated route and stores it.
    res.redirect(`${frontendUrl}/oauth-success?token=${token}`);
  } catch (error) {
    console.error(error);
    res.redirect(`${frontendUrl}/login?error=server_error`);
  }
};

// GET /api/auth/me
// Returns the currently logged-in user's info, based on the JWT.
// POST /api/auth/register/invitation
// Creates a new user account from a pending organization invitation.
exports.registerWithInvitation = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { token, first_name, last_name, password } = req.body;

    if (!token || !first_name || !password) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Token, first name and password are required.",
      });
    }

    // 1. Find valid invitation
    const invitation = await OrganizationInvitation.findOne({
      where: {
        token,
        status: "pending",
      },
      transaction,
    });

    if (!invitation) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Invitation not found or is no longer valid.",
      });
    }

    // 2. Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      invitation.status = "expired";

      await invitation.save({ transaction });
      await transaction.commit();

      return res.status(410).json({
        message: "This invitation has expired.",
      });
    }

    // 3. Check whether email already has an account
    const existingUser = await User.findOne({
      where: {
        email: invitation.email,
      },
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();

      return res.status(409).json({
        message:
          "An account already exists for this email. Please log in and accept the invitation.",
      });
    }

    // 4. Create user
    const user = await User.create(
      {
        first_name,
        last_name,
        email: invitation.email,
      },
      {
        transaction,
      }
    );

    // 5. Create password identity
    const password_hash = await bcrypt.hash(password, 10);

    await AuthIdentity.create(
      {
        user_id: user.id,
        provider: "local",
        password_hash,
      },
      {
        transaction,
      }
    );

    // 6. Add user to invited organization
    const membership = await OrganizationMember.create(
      {
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: invitation.role,
        is_active: true,
        joined_at: new Date(),
      },
      {
        transaction,
      }
    );

    // 7. Mark invitation accepted
    invitation.status = "accepted";
    invitation.accepted_at = new Date();

    await invitation.save({ transaction });

    // 8. Update login timestamp
    user.last_login_at = new Date();
    await user.save({ transaction });

    // 9. Generate JWT
    const jwtToken = generateToken({
      user,
      organizationId: membership.organization_id,
      role: membership.role,
    });

    await transaction.commit();

    // This flow is token-based and unauthenticated (no req.user). The actor is
    // the newly created user; the organization comes from the validated invitation.
    await createActivity({
      organization_id: invitation.organization_id,
      user_id: user.id,
      entity_type: "invitation",
      action: "updated",
      entity_id: invitation.id,
      project_id: null,
      task_id: null,
      description: `Accepted invitation`,
      metadata: {
        invitation_id: invitation.id,
        invitee_email: invitation.email,
        status: "accepted",
      },
    });

    return res.status(201).json({
      message: "Account created and invitation accepted successfully.",
      token: jwtToken,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: membership.role,
        organization_id: membership.organization_id,
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Invitation registration error:", error);

    return res.status(500).json({
      message: "Server error during invitation registration.",
    });
  }
};

// GET /api/auth/me
// Returns the currently logged-in user's info, based on the JWT.
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: req.user.role,
        organization_id: req.user.organization_id,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};