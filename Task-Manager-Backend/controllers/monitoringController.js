const crypto = require("crypto");
const { sequelize } = require("../config/db");
const { MonitoringEnrollment, MonitoringAgent, OrganizationMember, User } = require("../models");

// POST /api/monitoring/enrollments
exports.createMonitoringEnrollment = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        message: "user_id is required.",
      });
    }

    const organizationId = req.user.organization_id;

    // Target employee must exist.
    const targetUser = await User.findOne({
      where: { id: user_id },
    });

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Target employee must belong to the authenticated admin's organization.
    const organizationMember = await OrganizationMember.findOne({
      where: {
        organization_id: organizationId,
        user_id,
        is_active: true,
      },
    });

    if (!organizationMember) {
      return res.status(400).json({
        message: "User is not an active member of this organization.",
      });
    }

    // Prevent generating another active (unused, unexpired) enrollment for the same employee.
    const existingEnrollment = await MonitoringEnrollment.findOne({
      where: {
        organization_id: organizationId,
        user_id,
        used_at: null,
      },
      order: [["created_at", "DESC"]],
    });

    if (existingEnrollment && existingEnrollment.expires_at > new Date()) {
      return res.status(409).json({
        message: "An active enrollment already exists for this user.",
      });
    }

    // Generate a cryptographically secure random enrollment token.
    const token = crypto.randomBytes(32).toString("hex");

    // Never store the raw token — only its SHA-256 hash.
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Enrollment expires after 30 minutes.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const enrollment = await MonitoringEnrollment.create({
      organization_id: organizationId,
      user_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: req.user.id,
    });

    return res.status(201).json({
      message: "Monitoring enrollment created successfully.",
      enrollment: {
        id: enrollment.id,
        token,
        expires_at: enrollment.expires_at,
      },
    });
  } catch (error) {
    console.error("Create monitoring enrollment error:", error);

    return res.status(500).json({
      message: "Server error while creating monitoring enrollment.",
    });
  }
};

// POST /api/monitoring/agent/enroll
exports.enrollMonitoringAgent = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { token, device_name, platform, agent_version } = req.body;

    if (!token) {
      await transaction.rollback();

      return res.status(400).json({
        message: "token is required.",
      });
    }

    if (!device_name) {
      await transaction.rollback();

      return res.status(400).json({
        message: "device_name is required.",
      });
    }

    if (!platform) {
      await transaction.rollback();

      return res.status(400).json({
        message: "platform is required.",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const enrollment = await MonitoringEnrollment.findOne({
      where: { token_hash: tokenHash },
      transaction,
    });

    if (!enrollment) {
      await transaction.rollback();

      return res.status(401).json({
        message: "Invalid enrollment token.",
      });
    }

    if (enrollment.used_at) {
      await transaction.rollback();

      return res.status(401).json({
        message: "This enrollment token has already been used.",
      });
    }

    if (enrollment.expires_at < new Date()) {
      await transaction.rollback();

      return res.status(401).json({
        message: "This enrollment token has expired.",
      });
    }

    // Generate the permanent agent secret. Only its hash is ever persisted.
    const agentSecret = crypto.randomBytes(32).toString("hex");
    const agentSecretHash = crypto
      .createHash("sha256")
      .update(agentSecret)
      .digest("hex");

    const agent = await MonitoringAgent.create(
      {
        organization_id: enrollment.organization_id,
        user_id: enrollment.user_id,
        agent_uuid: crypto.randomUUID(),
        device_name,
        platform,
        agent_version: agent_version || null,
        status: "active",
        agent_secret_hash: agentSecretHash,
        last_seen_at: new Date(),
        enrolled_at: new Date(),
      },
      { transaction }
    );

    enrollment.used_at = new Date();
    await enrollment.save({ transaction });

    await transaction.commit();

    return res.status(201).json({
      message: "Monitoring agent enrolled successfully.",
      agent: {
        id: agent.id,
        agent_uuid: agent.agent_uuid,
        user_id: agent.user_id,
        organization_id: agent.organization_id,
        device_name: agent.device_name,
        platform: agent.platform,
        agent_version: agent.agent_version,
        status: agent.status,
        enrolled_at: agent.enrolled_at,
        agent_secret: agentSecret,
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Enroll monitoring agent error:", error);

    return res.status(500).json({
      message: "Server error while enrolling monitoring agent.",
    });
  }
};

// POST /api/monitoring/agent/heartbeat
exports.agentHeartbeat = async (req, res) => {
  try {
    const { agent_uuid, agent_secret } = req.body;

    if (!agent_uuid) {
      return res.status(400).json({
        message: "agent_uuid is required.",
      });
    }

    if (!agent_secret) {
      return res.status(400).json({
        message: "agent_secret is required.",
      });
    }

    const agent = await MonitoringAgent.findOne({
      where: { agent_uuid },
    });

    if (!agent) {
      return res.status(401).json({
        message: "Invalid agent credentials.",
      });
    }

    if (agent.status !== "active") {
      return res.status(401).json({
        message: "Invalid agent credentials.",
      });
    }

    const suppliedHash = crypto
      .createHash("sha256")
      .update(agent_secret)
      .digest();

    const storedHash = Buffer.from(agent.agent_secret_hash || "", "hex");

    const isMatch =
      storedHash.length === suppliedHash.length &&
      crypto.timingSafeEqual(storedHash, suppliedHash);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid agent credentials.",
      });
    }

    agent.last_seen_at = new Date();
    await agent.save();

    return res.status(200).json({
      message: "Heartbeat received.",
      agent: {
        id: agent.id,
        agent_uuid: agent.agent_uuid,
        status: agent.status,
        last_seen_at: agent.last_seen_at,
      },
    });
  } catch (error) {
    console.error("Agent heartbeat error:", error);

    return res.status(500).json({
      message: "Server error while processing agent heartbeat.",
    });
  }
};
