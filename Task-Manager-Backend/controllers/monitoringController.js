const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const {
  MonitoringAgent,
  MonitoringActivity,
  MonitoringEvent,
  MonitoringPcSession,
  MonitoringInterval,
  MonitoringAppSession,
  MonitoringWebSession,
  MonitoringUserDaySummary,
  MonitoringConsent,
  MonitoringOrgSetting,
  MonitoringBlocklistDomain,
  MonitoringContentEvent,
  MonitoringContentGrant,
  MonitoringContentAccessLog,
  OrganizationMember,
  User,
} = require("../models");
const { serverLocalDate, isClockSuspect } = require("../utils/monitoringTime");
const { enqueueRecompute } = require("../utils/monitoringRecompute");
const {
  CONTENT_CAPTURE_LEGALLY_APPROVED,
  CONTENT_CONSENT_DOCUMENT_VERSION,
} = require("../config/contentCaptureGate");
const monitoringContent = require("../services/monitoringContent");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_ACTIVITY_TYPES = ["application", "website", "idle"];

// Phase 5: the legacy /activities path (POST /agent/activities + GET
// /monitoring/activities) is FROZEN — the agent no longer writes to it and the
// dashboard no longer reads it. The routes stay mounted so historical data in
// monitoring_activities remains reachable and so a revert (agent PIPELINE_MODE=
// legacy or =dual) works without a redeploy. Mark every response and rate-limit
// a server log so lingering callers are visible.
const LEGACY_SUNSET = "Wed, 01 Jul 2026 00:00:00 GMT";
let _lastLegacyWarnAt = 0;
function markLegacyDeprecated(res, label) {
  res.set("Deprecation", "true");
  res.set("Sunset", LEGACY_SUNSET);
  res.set("Warning", `299 - "${label} is deprecated (Phase 5); use the derived monitoring API"`);
  const now = Date.now();
  if (now - _lastLegacyWarnAt > 60 * 60 * 1000) {
    _lastLegacyWarnAt = now;
    console.warn(`[monitoring] deprecated legacy endpoint used: ${label}`);
  }
}

// Raw event types accepted by POST /api/monitoring/agent/events. Must stay in
// sync with VALID_TYPES in the agent's src/monitoring/events.js.
const KNOWN_EVENT_TYPES = new Set([
  "agent_start",
  "heartbeat",
  "agent_stop",
  "session_end",
  "input_state",
  "screen_state",
  "app_focus",
  "browser_state",
]);

const MAX_EVENTS_PER_BATCH = 1000;

/**
 * Shared credential auth for the no-JWT agent endpoints. Returns { agent } on
 * success or { error: { status, message } }. Behaviour matches the inline check
 * in agentHeartbeat / submitMonitoringActivities exactly (those are intentionally
 * left untouched for now — this helper is used only by the events endpoint).
 */
async function authenticateAgentFromBody(body) {
  const agentUuid = body && body.agent_uuid;
  const agentSecret = body && body.agent_secret;

  if (!agentUuid) {
    return { error: { status: 400, message: "agent_uuid is required." } };
  }
  if (!agentSecret) {
    return { error: { status: 400, message: "agent_secret is required." } };
  }

  const agent = await MonitoringAgent.findOne({ where: { agent_uuid: agentUuid } });
  if (!agent || agent.status !== "active") {
    return { error: { status: 401, message: "Invalid agent credentials." } };
  }

  const suppliedHash = crypto.createHash("sha256").update(agentSecret).digest();
  const storedHash = Buffer.from(agent.agent_secret_hash || "", "hex");
  const isMatch =
    storedHash.length === suppliedHash.length &&
    crypto.timingSafeEqual(storedHash, suppliedHash);

  if (!isMatch) {
    return { error: { status: 401, message: "Invalid agent credentials." } };
  }

  return { agent };
}

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

// GET /api/monitoring/agents
// Owner/admin only. Lists the monitoring agents (devices) enrolled in the
// authenticated user's organization, with the employee they belong to and the
// liveness fields the events pipeline maintains. Org-scoped.
exports.listMonitoringAgents = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const agents = await MonitoringAgent.findAll({
      where: { organization_id: organizationId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email"],
          required: false,
        },
      ],
      attributes: [
        "id",
        "agent_uuid",
        "user_id",
        "device_name",
        "platform",
        "agent_version",
        "status",
        "last_seen_at",
        "last_heartbeat_at",
        "current_run_id",
        "enrolled_at",
        "created_at",
      ],
      order: [
        ["status", "ASC"], // active before revoked
        ["last_seen_at", "DESC"],
      ],
    });

    return res.json({ agents });
  } catch (error) {
    console.error("List monitoring agents error:", error);
    return res.status(500).json({
      message: "Server error while listing monitoring agents.",
    });
  }
};

// POST /api/monitoring/agents/:id/revoke
// Owner/admin only. Marks an agent revoked so its credentials stop working: the
// next heartbeat / activity / events request from that agent gets 401, which
// makes the desktop agent clear its stored credentials and disable auto-start.
// Already-collected data is untouched. Org-scoped; idempotent.
exports.revokeMonitoringAgent = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const agentId = parseInt(req.params.id, 10);

    if (Number.isNaN(agentId)) {
      return res.status(400).json({ message: "A numeric agent id is required." });
    }

    const agent = await MonitoringAgent.findOne({
      where: { id: agentId, organization_id: organizationId },
    });

    if (!agent) {
      return res.status(404).json({ message: "Monitoring agent not found." });
    }

    if (agent.status !== "revoked") {
      agent.status = "revoked";
      await agent.save();
    }

    return res.json({
      message: "Monitoring agent revoked.",
      agent: {
        id: agent.id,
        agent_uuid: agent.agent_uuid,
        device_name: agent.device_name,
        status: agent.status,
      },
    });
  } catch (error) {
    console.error("Revoke monitoring agent error:", error);
    return res.status(500).json({
      message: "Server error while revoking monitoring agent.",
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

    // §5b content-capture signal for the agent. The agent uses this to decide
    // whether to show the consent screen and whether to run the capture module
    // at all. `active` is only ever true when the legal gate is open AND the org
    // enabled it AND a matching consent row exists — capture stays fully off
    // otherwise. While CONTENT_CAPTURE_LEGALLY_APPROVED is false this block is
    // always { active: false, ... }.
    let contentCapture = {
      active: false,
      legal_gate_open: CONTENT_CAPTURE_LEGALLY_APPROVED,
      org_enabled: false,
      consent_required: false,
      consented: false,
      document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
    };
    try {
      const orgSettings = await MonitoringOrgSetting.findOne({
        where: { organization_id: agent.organization_id },
        raw: true,
      });
      const orgEnabled = Boolean(orgSettings && orgSettings.content_capture_enabled);
      if (CONTENT_CAPTURE_LEGALLY_APPROVED && orgEnabled) {
        const consent = await MonitoringConsent.findOne({
          where: {
            user_id: agent.user_id,
            document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
          },
          raw: true,
        });
        contentCapture = {
          active: Boolean(consent),
          legal_gate_open: true,
          org_enabled: true,
          consent_required: true,
          consented: Boolean(consent),
          document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
        };
      }
    } catch (ccErr) {
      console.error("Heartbeat content-capture check failed:", ccErr);
    }

    return res.status(200).json({
      message: "Heartbeat received.",
      agent: {
        id: agent.id,
        agent_uuid: agent.agent_uuid,
        status: agent.status,
        last_seen_at: agent.last_seen_at,
      },
      content_capture: contentCapture,
    });
  } catch (error) {
    console.error("Agent heartbeat error:", error);

    return res.status(500).json({
      message: "Server error while processing agent heartbeat.",
    });
  }
};

// POST /api/monitoring/agent/activities  — DEPRECATED (Phase 5), still functional
// for a `PIPELINE_MODE=legacy|dual` agent during a revert. The default agent no
// longer calls this.
exports.submitMonitoringActivities = async (req, res) => {
  try {
    markLegacyDeprecated(res, "POST /api/monitoring/agent/activities");
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

// POST /api/monitoring/agent/activities  (legacy path — unchanged, still live)
// POST /api/monitoring/agent/events
//
// Append-only ingest of raw agent events (the events pipeline). Idempotent on
// (agent_id, client_event_id): a replayed batch inserts nothing new and returns
// the same accepted ids, so the agent can safely drop them from its local
// queue. Each event's own local_date (server local tz) is enqueued for
// derivation.
exports.submitMonitoringEvents = async (req, res) => {
  try {
    const auth = await authenticateAgentFromBody(req.body);
    if (auth.error) {
      return res.status(auth.error.status).json({ message: auth.error.message });
    }
    const agent = auth.agent;

    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: "events must be a non-empty array." });
    }
    if (events.length > MAX_EVENTS_PER_BATCH) {
      return res.status(400).json({
        message: `events batch too large (max ${MAX_EVENTS_PER_BATCH}).`,
      });
    }

    const receivedAt = new Date();
    const acceptedEventIds = [];
    const rowsById = new Map(); // client_event_id -> row (dedupes within the batch)

    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i] || {};
      const position = i + 1;

      const clientEventId =
        typeof ev.client_event_id === "string" ? ev.client_event_id.trim() : "";
      if (!clientEventId) {
        return res
          .status(400)
          .json({ message: `client_event_id is required at event ${position}.` });
      }
      if (!KNOWN_EVENT_TYPES.has(ev.type)) {
        return res
          .status(400)
          .json({ message: `Invalid event type at event ${position}.` });
      }
      if (typeof ev.run_id !== "string" || !ev.run_id) {
        return res
          .status(400)
          .json({ message: `run_id is required at event ${position}.` });
      }
      const occurredAt = new Date(ev.occurred_at);
      if (Number.isNaN(occurredAt.getTime())) {
        return res
          .status(400)
          .json({ message: `Invalid occurred_at at event ${position}.` });
      }
      if (ev.payload != null && typeof ev.payload !== "object") {
        return res
          .status(400)
          .json({ message: `payload must be an object or null at event ${position}.` });
      }

      acceptedEventIds.push(clientEventId);
      if (rowsById.has(clientEventId)) continue;

      rowsById.set(clientEventId, {
        organization_id: agent.organization_id,
        user_id: agent.user_id,
        agent_id: agent.id,
        type: ev.type,
        payload: ev.payload ?? null,
        occurred_at: occurredAt,
        monotonic_ms: Number.isFinite(ev.monotonic_ms) ? ev.monotonic_ms : null,
        run_id: ev.run_id,
        os_boot_time: Number.isFinite(ev.os_boot_time)
          ? Math.round(ev.os_boot_time)
          : null,
        client_event_id: clientEventId,
        client_seq: Number.isFinite(ev.client_seq)
          ? Math.round(ev.client_seq)
          : null,
        local_date: serverLocalDate(occurredAt),
        received_at: receivedAt,
        clock_suspect: isClockSuspect(occurredAt, receivedAt),
      });
    }

    const candidateRows = [...rowsById.values()];

    // Idempotency: skip anything already stored for this agent.
    const existing = await MonitoringEvent.findAll({
      where: {
        agent_id: agent.id,
        client_event_id: { [Op.in]: candidateRows.map((r) => r.client_event_id) },
      },
      attributes: ["client_event_id"],
      raw: true,
    });
    const existingIds = new Set(existing.map((e) => e.client_event_id));
    const toInsert = candidateRows.filter((r) => !existingIds.has(r.client_event_id));

    let insertedCount = 0;
    if (toInsert.length > 0) {
      const localDates = [...new Set(toInsert.map((r) => r.local_date))];
      await sequelize.transaction(async (transaction) => {
        await MonitoringEvent.bulkCreate(toInsert, {
          transaction,
          ignoreDuplicates: true,
        });
        await enqueueRecompute({ agentId: agent.id, localDates, transaction });
      });
      insertedCount = toInsert.length;
    }

    // Liveness: reflect the newest event in this batch onto the agent row so the
    // devices list shows real state (last heartbeat, current run, last boot).
    // Best-effort and never rewinds on an out-of-order batch.
    try {
      const newest = candidateRows.reduce((a, b) =>
        b.occurred_at > a.occurred_at ? b : a
      );
      const patch = { last_heartbeat_at: newest.occurred_at };
      if (newest.run_id) patch.current_run_id = newest.run_id;
      if (Number.isFinite(newest.os_boot_time)) {
        patch.last_os_boot_time = newest.os_boot_time;
      }
      await MonitoringAgent.update(patch, {
        where: {
          id: agent.id,
          [Op.or]: [
            { last_heartbeat_at: null },
            { last_heartbeat_at: { [Op.lt]: newest.occurred_at } },
          ],
        },
      });
    } catch (livenessErr) {
      console.error("Monitoring agent liveness update failed:", livenessErr);
    }

    return res.status(201).json({
      message: "Monitoring events received.",
      accepted_count: acceptedEventIds.length,
      inserted_count: insertedCount,
      accepted_event_ids: acceptedEventIds,
    });
  } catch (error) {
    console.error("Submit monitoring events error:", error);
    return res.status(500).json({
      message: "Server error while submitting monitoring events.",
    });
  }
};

// GET /api/monitoring/activities — DEPRECATED (Phase 5). Read-only historical
// access to monitoring_activities. The dashboard reads /summary + /daily now.
exports.getMonitoringActivities = async (req, res) => {
  try {
    markLegacyDeprecated(res, "GET /api/monitoring/activities");
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

// GET /api/monitoring/summary?from&to&user_id&page&page_size
// Owner/admin only. Derived per-user daily summaries for the dashboard cards,
// scoped to the authenticated user's organization. Bounded window (default the
// last 7 days) and paginated.
exports.getMonitoringSummary = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { user_id, from, to } = req.query;

    const where = { organization_id: organizationId };
    if (user_id) where.user_id = user_id;

    if ((from && DATE_RE.test(from)) || (to && DATE_RE.test(to))) {
      where.local_date = {};
      if (from && DATE_RE.test(from)) where.local_date[Op.gte] = from;
      if (to && DATE_RE.test(to)) where.local_date[Op.lte] = to;
    } else {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      where.local_date = {
        [Op.gte]: serverLocalDate(start),
        [Op.lte]: serverLocalDate(new Date()),
      };
    }

    let pageSize = parseInt(req.query.page_size, 10);
    if (Number.isNaN(pageSize) || pageSize <= 0) pageSize = 50;
    if (pageSize > 200) pageSize = 200;
    let page = parseInt(req.query.page, 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    const { rows, count } = await MonitoringUserDaySummary.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email"],
          required: false,
        },
      ],
      order: [
        ["local_date", "DESC"],
        ["user_id", "ASC"],
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return res.json({
      summaries: rows,
      page,
      page_size: pageSize,
      total: count,
    });
  } catch (error) {
    console.error("Get monitoring summary error:", error);
    return res.status(500).json({
      message: "Server error while fetching monitoring summary.",
    });
  }
};

// GET /api/monitoring/daily?user_id&date&agent_id?
// Owner/admin only. Full day detail for one employee: the per-device PC
// session(s), their classified intervals (timeline source), app/website
// sessions, and the merged user-day summary. Org-scoped.
exports.getMonitoringDaily = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { user_id, date, agent_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ message: "user_id is required." });
    }
    if (!date || !DATE_RE.test(date)) {
      return res.status(400).json({ message: "date (YYYY-MM-DD) is required." });
    }

    const pcWhere = {
      organization_id: organizationId,
      user_id,
      local_date: date,
    };
    if (agent_id) pcWhere.agent_id = agent_id;

    const pcSessions = await MonitoringPcSession.findAll({
      where: pcWhere,
      include: [
        {
          model: MonitoringAgent,
          as: "agent",
          attributes: ["id", "agent_uuid", "device_name", "platform", "status"],
          required: false,
        },
      ],
      order: [["first_pc_on", "ASC"]],
    });

    const summary = await MonitoringUserDaySummary.findOne({
      where: { organization_id: organizationId, user_id, local_date: date },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email"],
          required: false,
        },
      ],
    });

    const user =
      (summary && summary.user) ||
      (await User.findByPk(user_id, {
        attributes: ["id", "first_name", "last_name", "email"],
      }));

    const devices = await Promise.all(
      pcSessions.map(async (pc) => {
        const [intervals, appSessions, webSessions] = await Promise.all([
          MonitoringInterval.findAll({
            where: { pc_session_id: pc.id },
            order: [["started_at", "ASC"]],
          }),
          MonitoringAppSession.findAll({
            where: { pc_session_id: pc.id },
            order: [["started_at", "ASC"]],
          }),
          MonitoringWebSession.findAll({
            where: { pc_session_id: pc.id },
            order: [["started_at", "ASC"]],
          }),
        ]);
        return {
          agent: pc.agent,
          pc_session: pc,
          intervals,
          app_sessions: appSessions,
          web_sessions: webSessions,
        };
      })
    );

    return res.json({ date, user: user || null, summary: summary || null, devices });
  } catch (error) {
    console.error("Get monitoring daily error:", error);
    return res.status(500).json({
      message: "Server error while fetching monitoring day detail.",
    });
  }
};

// ===========================================================================
// §5b captured content — consent, ingest, read. All fail CLOSED.
// ===========================================================================

// POST /api/monitoring/agent/consent
// Agent-authenticated. Records the employee's acceptance of the current consent
// document. Not gated by CONTENT_CAPTURE_LEGALLY_APPROVED — consent rows must be
// able to exist BEFORE the flag is flipped. Idempotent per (user, version).
exports.submitAgentConsent = async (req, res) => {
  try {
    const auth = await authenticateAgentFromBody(req.body);
    if (auth.error) {
      return res.status(auth.error.status).json({ message: auth.error.message });
    }
    const agent = auth.agent;

    const documentVersion =
      typeof req.body.document_version === "string" && req.body.document_version.trim()
        ? req.body.document_version.trim()
        : CONTENT_CONSENT_DOCUMENT_VERSION;

    if (documentVersion !== CONTENT_CONSENT_DOCUMENT_VERSION) {
      return res.status(409).json({
        message: "Consent document version mismatch.",
        expected_document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
      });
    }

    const method =
      typeof req.body.method === "string" && req.body.method.trim()
        ? req.body.method.trim().slice(0, 20)
        : "agent";

    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      null;

    const [consent, created] = await MonitoringConsent.findOrCreate({
      where: { user_id: agent.user_id, document_version: documentVersion },
      defaults: {
        organization_id: agent.organization_id,
        user_id: agent.user_id,
        document_version: documentVersion,
        accepted_at: new Date(),
        method,
        ip,
      },
    });

    // Reflect on the agent row (used by the agent-list liveness view).
    await MonitoringAgent.update(
      { content_consent_at: consent.accepted_at },
      { where: { id: agent.id } }
    ).catch(() => {});

    return res.status(created ? 201 : 200).json({
      message: created ? "Consent recorded." : "Consent already on file.",
      document_version: documentVersion,
      accepted_at: consent.accepted_at,
    });
  } catch (error) {
    console.error("Submit agent consent error:", error);
    return res.status(500).json({ message: "Server error while recording consent." });
  }
};

// POST /api/monitoring/agent/content
// Agent-authenticated. Ingest of captured search terms / AI prompts. Returns 501
// while CONTENT_CAPTURE_LEGALLY_APPROVED is false. Otherwise re-validates every
// safeguard server-side (keys configured, org enabled, consent on file, domain
// not blocklisted, not a password field), drops anything failing, encrypts the
// survivors, and inserts with expires_at.
exports.submitMonitoringContent = async (req, res) => {
  try {
    if (!CONTENT_CAPTURE_LEGALLY_APPROVED) {
      return res.status(501).json({ message: "Content capture is not enabled." });
    }

    const auth = await authenticateAgentFromBody(req.body);
    if (auth.error) {
      return res.status(auth.error.status).json({ message: auth.error.message });
    }

    const result = await monitoringContent.ingestContent({
      agent: auth.agent,
      items: req.body.items,
      models: {
        MonitoringOrgSetting,
        MonitoringConsent,
        MonitoringBlocklistDomain,
        MonitoringContentEvent,
      },
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Submit monitoring content error:", error);
    return res.status(500).json({ message: "Server error while submitting content." });
  }
};

// GET /api/monitoring/content?user_id&from&to
// JWT-authenticated. Owner-only by default; a non-owner needs an active
// monitoring_content_grants row. An audit row is written BEFORE any content is
// returned. Content is decrypted on the fly. 403 while the gate is closed.
exports.getMonitoringContent = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const targetUserId = parseInt(req.query.user_id, 10);
    const { from, to } = req.query;

    if (Number.isNaN(targetUserId)) {
      return res.status(400).json({ message: "user_id is required." });
    }
    if (!from || !DATE_RE.test(from) || !to || !DATE_RE.test(to)) {
      return res.status(400).json({ message: "from and to (YYYY-MM-DD) are required." });
    }

    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      null;

    const result = await monitoringContent.readContent({
      organizationId,
      viewer: { id: req.user.id, role: req.user.role },
      targetUserId,
      from,
      to,
      ip,
      models: {
        MonitoringContentGrant,
        MonitoringContentAccessLog,
        MonitoringContentEvent,
      },
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Get monitoring content error:", error);
    return res.status(500).json({ message: "Server error while fetching content." });
  }
};
