const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const {
  MonitoringEnrollment,
  MonitoringAgent,
  MonitoringActivity,
  OrganizationMember,
  User,
} = require("../models");

const ALLOWED_ACTIVITY_TYPES = ["application", "website", "idle"];

// Single source of truth for monitoring-agent credential generation.
// Used by both the token-based agent self-enrollment and the dashboard-driven
// employee enrollment. The raw secret is returned to the caller exactly once
// and only its SHA-256 hash is ever persisted.
function generateAgentCredentials() {
  const agentSecret = crypto.randomBytes(32).toString("hex");
  const agentSecretHash = crypto
    .createHash("sha256")
    .update(agentSecret)
    .digest("hex");

  return {
    agentUuid: crypto.randomUUID(),
    agentSecret,
    agentSecretHash,
  };
}

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

// POST /api/monitoring/agents
// Dashboard-driven enrollment: an owner/admin picks an existing organization
// employee and a device name, and the backend creates the monitoring agent and
// returns its credentials once. This does not create a new employee/user — the
// employee must already be an active member of the caller's organization.
exports.enrollEmployeeAgent = async (req, res) => {
  try {
    const { user_id, device_name, platform } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "user_id is required." });
    }

    const deviceName =
      typeof device_name === "string" ? device_name.trim() : "";

    if (!deviceName) {
      return res.status(400).json({ message: "device_name is required." });
    }

    // Organization ownership is always derived from the authenticated user,
    // never from the request body.
    const organizationId = req.user.organization_id;

    // The employee must be an active member of the caller's organization.
    const organizationMember = await OrganizationMember.findOne({
      where: {
        organization_id: organizationId,
        user_id,
        is_active: true,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
    });

    if (!organizationMember) {
      return res.status(404).json({
        message: "Employee not found in your organization.",
      });
    }

    // Avoid creating a second active agent for the same employee + device.
    const existingAgent = await MonitoringAgent.findOne({
      where: {
        organization_id: organizationId,
        user_id,
        device_name: deviceName,
        status: "active",
      },
    });

    if (existingAgent) {
      return res.status(409).json({
        message:
          "An active monitoring agent already exists for this employee and device.",
      });
    }

    const { agentUuid, agentSecret, agentSecretHash } =
      generateAgentCredentials();

    const agent = await MonitoringAgent.create({
      organization_id: organizationId,
      user_id,
      agent_uuid: agentUuid,
      device_name: deviceName,
      platform: platform && String(platform).trim() ? String(platform).trim() : "windows",
      status: "active",
      agent_secret_hash: agentSecretHash,
      enrolled_at: new Date(),
    });

    const employee = organizationMember.user;
    const employeeName =
      `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
      employee.email;

    // The raw agent_secret is returned here and nowhere else. It is never
    // logged and never stored in plaintext.
    return res.status(201).json({
      message: "Monitoring agent enrolled successfully.",
      agent: {
        id: agent.id,
        agent_uuid: agent.agent_uuid,
        agent_secret: agentSecret,
        user_id: agent.user_id,
        organization_id: agent.organization_id,
        device_name: agent.device_name,
        platform: agent.platform,
        status: agent.status,
        enrolled_at: agent.enrolled_at,
        employee: {
          id: employee.id,
          name: employeeName,
          email: employee.email,
        },
      },
    });
  } catch (error) {
    console.error("Enroll employee agent error:", error);

    return res.status(500).json({
      message: "Server error while enrolling monitoring agent.",
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
    const { agentUuid, agentSecret, agentSecretHash } = generateAgentCredentials();

    const agent = await MonitoringAgent.create(
      {
        organization_id: enrollment.organization_id,
        user_id: enrollment.user_id,
        agent_uuid: agentUuid,
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

// POST /api/monitoring/agent/activities
exports.submitMonitoringActivities = async (req, res) => {
  try {
    const { agent_uuid, agent_secret, activities } = req.body;

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

    // Authenticate the agent using the same logic as agentHeartbeat.
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

    // Validate the activities batch.
    if (!Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({
        message: "activities must be a non-empty array.",
      });
    }

    const rows = [];

    for (let i = 0; i < activities.length; i += 1) {
      const activity = activities[i] || {};
      const position = i + 1;

      const {
        activity_type,
        application_name,
        window_title,
        domain,
        started_at,
        ended_at,
        duration_seconds,
      } = activity;

      if (!ALLOWED_ACTIVITY_TYPES.includes(activity_type)) {
        return res.status(400).json({
          message: `Invalid activity_type at activity ${position}.`,
        });
      }

      const startedDate = new Date(started_at);
      const endedDate = new Date(ended_at);

      if (Number.isNaN(startedDate.getTime()) || Number.isNaN(endedDate.getTime())) {
        return res.status(400).json({
          message: `Invalid started_at or ended_at at activity ${position}.`,
        });
      }

      if (endedDate.getTime() < startedDate.getTime()) {
        return res.status(400).json({
          message: `ended_at must be greater than or equal to started_at at activity ${position}.`,
        });
      }

      if (
        typeof duration_seconds !== "number" ||
        !Number.isInteger(duration_seconds) ||
        duration_seconds < 0
      ) {
        return res.status(400).json({
          message: `duration_seconds must be a non-negative integer at activity ${position}.`,
        });
      }

      rows.push({
        organization_id: agent.organization_id,
        agent_id: agent.id,
        user_id: agent.user_id,
        activity_type,
        application_name: application_name ?? null,
        window_title: window_title ?? null,
        domain: domain ?? null,
        started_at: startedDate,
        ended_at: endedDate,
        duration_seconds,
      });
    }

    const inserted = await MonitoringActivity.bulkCreate(rows);

    return res.status(201).json({
      message: "Monitoring activities submitted successfully.",
      inserted_count: inserted.length,
    });
  } catch (error) {
    console.error("Submit monitoring activities error:", error);

    return res.status(500).json({
      message: "Server error while submitting monitoring activities.",
    });
  }
};

// GET /api/monitoring/activities
exports.getMonitoringActivities = async (req, res) => {
  try {
    const { agent_id, user_id, activity_type, from, to } = req.query;

    const DEFAULT_LIMIT = 100;
    const MAX_LIMIT = 500;

    let limit = parseInt(req.query.limit, 10);

    if (Number.isNaN(limit) || limit <= 0) {
      limit = DEFAULT_LIMIT;
    }

    if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }

    // Authorization is always derived from the authenticated user's organization.
    const where = {
      organization_id: req.user.organization_id,
    };

    if (agent_id) {
      where.agent_id = agent_id;
    }

    if (user_id) {
      where.user_id = user_id;
    }

    if (activity_type && ALLOWED_ACTIVITY_TYPES.includes(activity_type)) {
      where.activity_type = activity_type;
    }

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      where.started_at = { ...(where.started_at || {}), [Op.gte]: fromDate };
    }

    if (toDate && !Number.isNaN(toDate.getTime())) {
      where.started_at = { ...(where.started_at || {}), [Op.lte]: toDate };
    }

    const activities = await MonitoringActivity.findAll({
      where,

      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email"],
          required: false,
        },
        {
          model: MonitoringAgent,
          as: "agent",
          attributes: [
            "id",
            "agent_uuid",
            "device_name",
            "platform",
            "status",
          ],
          required: false,
        },
      ],

      attributes: [
        "id",
        "activity_type",
        "application_name",
        "window_title",
        "domain",
        "started_at",
        "ended_at",
        "duration_seconds",
        "created_at",
      ],

      order: [["started_at", "DESC"]],

      limit,
    });

    return res.json({
      activities,
    });
  } catch (error) {
    console.error("Get monitoring activities error:", error);

    return res.status(500).json({
      message: "Server error while fetching monitoring activities.",
    });
  }
};
