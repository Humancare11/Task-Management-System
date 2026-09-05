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
  MonitoringRecomputeQueue,
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
const monitoringRecomputeRunner = require("../services/monitoringRecomputeRunner");
const {
  CONTENT_CAPTURE_LEGALLY_APPROVED,
  CONTENT_CONSENT_DOCUMENT_VERSION,
} = require("../config/contentCaptureGate");
const {
  CONTENT_CONSENT_DOCUMENT_TITLE,
  CONTENT_CONSENT_DOCUMENT_TEXT,
} = require("../config/contentConsentDocument");
const { isConfigured: contentKeysConfigured } = require("../utils/contentCrypto");
const { loadActivePatterns } = require("../utils/contentBlocklist");
const monitoringContent = require("../services/monitoringContent");
const {
  LIVE_SCREEN_LEGALLY_APPROVED,
} = require("../config/liveScreenGate");
const {
  LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
  LIVE_SCREEN_CONSENT_DOCUMENT_TITLE,
  LIVE_SCREEN_CONSENT_DOCUMENT_TEXT,
} = require("../config/liveScreenConsentDocument");
const liveScreen = require("../services/monitoringLiveScreen");
const monitoringScreenshot = require("../services/monitoringScreenshot");

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

    // §5b content-capture signal for the agent.
    //   - `consent_required` is true whenever the ORG has enabled content
    //     capture — independent of the legal gate — so the agent shows the
    //     notice and consent rows can be collected BEFORE the flag is flipped.
    //   - `active` (the only thing that turns capture on) still requires ALL of:
    //     legal gate open AND org enabled AND a matching consent row.
    //   - the full notice text is included only while consent is still needed,
    //     to keep routine heartbeats small.
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
      if (orgEnabled) {
        const consent = await MonitoringConsent.findOne({
          where: {
            user_id: agent.user_id,
            document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
          },
          raw: true,
        });
        const consented = Boolean(consent);
        // Blocklist the agent must enforce for capture: hardcoded categories
        // (banking / payment / healthcare / government) ∪ the operator-tunable
        // monitoring_blocklist_domains table. Cached ~5 min in loadActivePatterns.
        let blocklistPatterns = [];
        try {
          blocklistPatterns = await loadActivePatterns(MonitoringBlocklistDomain);
        } catch (blErr) {
          console.error("Heartbeat blocklist load failed:", blErr);
        }
        contentCapture = {
          active: CONTENT_CAPTURE_LEGALLY_APPROVED && consented,
          legal_gate_open: CONTENT_CAPTURE_LEGALLY_APPROVED,
          org_enabled: true,
          consent_required: true,
          consented,
          document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
          blocklist_patterns: blocklistPatterns,
        };
        if (!consented) {
          contentCapture.document_title = CONTENT_CONSENT_DOCUMENT_TITLE;
          contentCapture.document_text = CONTENT_CONSENT_DOCUMENT_TEXT;
        }
      }
    } catch (ccErr) {
      console.error("Heartbeat content-capture check failed:", ccErr);
    }

    // Live Screen signal.
    //   - `pending` true when a viewer has an open session waiting for this
    //     agent — the agent then fast-polls /agent/livescreen and captures.
    //   - `consent_required` (org enabled) makes the agent show the live-screen
    //     notice; a session can only run with a matching consent row.
    let liveScreenBlock = {
      pending: false,
      legal_gate_open: LIVE_SCREEN_LEGALLY_APPROVED,
      consent_required: false,
      consented: false,
      document_version: LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
    };
    try {
      const lsOrg = await MonitoringOrgSetting.findOne({
        where: { organization_id: agent.organization_id },
        raw: true,
      });
      const lsEnabled = Boolean(lsOrg && lsOrg.live_screen_enabled);
      const directive = liveScreen.agentDirective(agent.id);
      const pending = directive.action === "start" || directive.action === "keep";
      if (lsEnabled || pending) {
        const lsConsent = await MonitoringConsent.findOne({
          where: {
            user_id: agent.user_id,
            document_version: LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
          },
          raw: true,
        });
        const consented = Boolean(lsConsent);
        liveScreenBlock = {
          pending: pending && LIVE_SCREEN_LEGALLY_APPROVED && consented,
          legal_gate_open: LIVE_SCREEN_LEGALLY_APPROVED,
          consent_required: lsEnabled,
          consented,
          document_version: LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
        };
        if (lsEnabled && !consented) {
          liveScreenBlock.document_title = LIVE_SCREEN_CONSENT_DOCUMENT_TITLE;
          liveScreenBlock.document_text = LIVE_SCREEN_CONSENT_DOCUMENT_TEXT;
        }
      }
    } catch (lsErr) {
      console.error("Heartbeat live-screen check failed:", lsErr);
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
      live_screen: liveScreenBlock,
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

    // Derivation trigger. The background runner is a timer, which shared hosts
    // (Passenger) suspend when the app is idle — so every ingest also nudges the
    // recompute queue forward. Fire-and-forget: never blocks or fails the
    // response, and drainOnce()'s own guard prevents overlap.
    monitoringRecomputeRunner.kick();

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

// POST /api/monitoring/recompute   { date?, agent_id?, user_id? }
// Owner/admin. Manual derivation trigger + diagnostics. Recovery tool for
// environments where the background runner's timer gets suspended (shared
// hosting / Passenger). Does NOT change derivation logic — it just runs the
// existing drainOnce() now, optionally forcing specific (agent, date) rows due
// first (bypassing the ingest debounce). Org-scoped.
exports.triggerMonitoringRecompute = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { date, agent_id, user_id } = req.body || {};

    const agentWhere = { organization_id: organizationId };
    if (agent_id) agentWhere.id = agent_id;
    if (user_id) agentWhere.user_id = user_id;
    const orgAgents = await MonitoringAgent.findAll({
      where: agentWhere,
      attributes: ["id"],
      raw: true,
    });
    const agentIds = orgAgents.map((a) => a.id);

    let forced = 0;
    if (agentIds.length > 0) {
      const now = new Date();
      if (date && DATE_RE.test(date)) {
        // Enqueue (or re-arm) that day for each targeted agent, due immediately.
        for (const id of agentIds) {
          // eslint-disable-next-line no-await-in-loop
          await MonitoringRecomputeQueue.upsert({
            agent_id: id,
            local_date: date,
            status: "pending",
            not_before: now,
          });
          forced += 1;
        }
      }
      // Make every not-yet-done row for this org's agents runnable right now:
      // pending -> due now (ignore debounce/backoff), and reclaim any 'running'
      // orphan left by a killed worker. Rows in 'error' are left alone.
      await MonitoringRecomputeQueue.update(
        { status: "pending", not_before: now },
        {
          where: {
            status: { [Op.in]: ["pending", "running"] },
            agent_id: { [Op.in]: agentIds },
          },
        }
      );
    }

    await monitoringRecomputeRunner.drainOnce();

    const queueRows = await MonitoringRecomputeQueue.findAll({
      where: agentIds.length ? { agent_id: { [Op.in]: agentIds } } : {},
      attributes: ["agent_id", "local_date", "status", "attempts", "last_error", "not_before"],
      order: [["local_date", "DESC"]],
      raw: true,
    });

    return res.json({
      message: "Recompute drained.",
      forced_due: forced,
      runner: monitoringRecomputeRunner.status(),
      queue: queueRows,
    });
  } catch (error) {
    console.error("Trigger monitoring recompute error:", error);
    return res.status(500).json({
      message: "Server error while running recompute.",
    });
  }
};

// GET /api/monitoring/consents
// Owner/admin. For the CURRENT consent document version: which monitored users
// (users with an active agent) have accepted, and the checklist of what still
// has to be true before content capture can run. Read-only — changes nothing.
exports.getMonitoringConsentStatus = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const agents = await MonitoringAgent.findAll({
      where: { organization_id: organizationId, status: "active" },
      attributes: ["user_id"],
      raw: true,
    });
    const userIds = [...new Set(agents.map((a) => a.user_id))];

    const [users, consents, orgSettings] = await Promise.all([
      userIds.length
        ? User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ["id", "first_name", "last_name", "email"],
            raw: true,
          })
        : [],
      userIds.length
        ? MonitoringConsent.findAll({
            where: {
              user_id: { [Op.in]: userIds },
              document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
            },
            attributes: ["user_id", "accepted_at", "method"],
            raw: true,
          })
        : [],
      MonitoringOrgSetting.findOne({
        where: { organization_id: organizationId },
        raw: true,
      }),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const consentByUser = new Map(consents.map((c) => [c.user_id, c]));

    const rows = userIds
      .map((uid) => {
        const u = userById.get(uid) || { id: uid };
        const c = consentByUser.get(uid) || null;
        const name =
          `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
          u.email ||
          `User ${uid}`;
        return {
          user_id: uid,
          name,
          email: u.email || null,
          consented: Boolean(c),
          accepted_at: c ? c.accepted_at : null,
          method: c ? c.method : null,
        };
      })
      .sort(
        (a, b) =>
          Number(a.consented) - Number(b.consented) || a.name.localeCompare(b.name)
      );

    const consentedCount = rows.filter((r) => r.consented).length;
    const allConsented = rows.length > 0 && consentedCount === rows.length;

    return res.json({
      document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
      monitored_user_count: rows.length,
      consented_count: consentedCount,
      all_monitored_users_consented: allConsented,
      users: rows,
      // What still has to be true before capture can run (each independent):
      remaining_to_enable_capture: {
        all_monitored_users_consented: allConsented,
        encryption_keys_configured: contentKeysConfigured(),
        org_setting_content_capture_enabled: Boolean(
          orgSettings && orgSettings.content_capture_enabled
        ),
        legal_gate_CONTENT_CAPTURE_LEGALLY_APPROVED: CONTENT_CAPTURE_LEGALLY_APPROVED,
      },
    });
  } catch (error) {
    console.error("Get monitoring consent status error:", error);
    return res
      .status(500)
      .json({ message: "Server error while fetching consent status." });
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

    // The agent records either the §5b content-capture consent or the Live
    // Screen setup consent through this one endpoint. Anything else is stale.
    const ACCEPTED_VERSIONS = [
      CONTENT_CONSENT_DOCUMENT_VERSION,
      LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
    ];
    if (!ACCEPTED_VERSIONS.includes(documentVersion)) {
      return res.status(409).json({
        message: "Consent document version mismatch.",
        expected_document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
      });
    }
    const isLiveScreen = documentVersion === LIVE_SCREEN_CONSENT_DOCUMENT_VERSION;

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

    // Reflect the §5b consent on the agent row (used by the agent-list liveness
    // view). The Live Screen consent is tracked only by its monitoring_consents
    // row.
    if (!isLiveScreen) {
      await MonitoringAgent.update(
        { content_consent_at: consent.accepted_at },
        { where: { id: agent.id } }
      ).catch(() => {});
    }

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

// ===========================================================================
// Live Screen — agent signaling (no JWT; agent_uuid + agent_secret in body).
// Media is peer-to-peer WebRTC; these endpoints relay ONLY SDP/ICE text and
// only while a session is open. 501 whenever the legal gate is closed, so the
// agent never captures the screen.
// ===========================================================================

// POST /api/monitoring/agent/livescreen
// Body: { agent_uuid, agent_secret }. Returns the current directive:
//   { action: "none" }
//   { action: "start", session_id, ice_servers, answer?, viewer_ice[] }
//   { action: "keep",  session_id, viewer_ice[] }
//   { action: "stop",  session_id }
exports.getAgentLiveScreen = async (req, res) => {
  try {
    if (!LIVE_SCREEN_LEGALLY_APPROVED) {
      return res.status(501).json({ message: "Live screen is not enabled." });
    }
    const auth = await authenticateAgentFromBody(req.body);
    if (auth.error) {
      return res.status(auth.error.status).json({ message: auth.error.message });
    }
    return res.status(200).json(liveScreen.agentDirective(auth.agent.id));
  } catch (error) {
    console.error("getAgentLiveScreen error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

// GET /api/monitoring/livescreen/diagnostics?user_id=<employee>
// Owner/admin. One call that reports every precondition for Live Screen so a
// failed session can be diagnosed without server access.
exports.getLiveScreenDiagnostics = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const targetUserId = req.query.user_id
      ? parseInt(req.query.user_id, 10)
      : null;

    const schema = await liveScreen.schemaHealth(sequelize);

    let orgSettings = null;
    try {
      orgSettings = await MonitoringOrgSetting.findOne({
        where: { organization_id: organizationId },
        attributes: ["organization_id", "live_screen_enabled"],
        raw: true,
      });
    } catch (e) {
      schema.error = schema.error || e.message;
    }

    const iceServers = liveScreen.iceServers();
    const hasTurn = iceServers.some((s) =>
      []
        .concat(s.urls || [])
        .some((u) => /^turns?:/i.test(String(u))),
    );

    let target = null;
    if (targetUserId) {
      const [agent, consent] = await Promise.all([
        MonitoringAgent.findOne({
          where: {
            organization_id: organizationId,
            user_id: targetUserId,
            status: "active",
          },
          order: [["last_seen_at", "DESC"]],
          raw: true,
        }),
        MonitoringConsent.findOne({
          where: {
            user_id: targetUserId,
            document_version: LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
          },
          raw: true,
        }).catch(() => null),
      ]);
      const seenMsAgo =
        agent && agent.last_seen_at
          ? Date.now() - new Date(agent.last_seen_at).getTime()
          : null;
      target = {
        user_id: targetUserId,
        agent_registered: Boolean(agent),
        agent_id: agent ? agent.id : null,
        agent_last_seen_at: agent ? agent.last_seen_at : null,
        agent_online: Boolean(seenMsAgo != null && seenMsAgo < 90 * 1000),
        consent_recorded: Boolean(consent),
        consent_version: LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
        consent_accepted_at: consent ? consent.accepted_at : null,
      };
    }

    return res.json({
      legal_gate_open: LIVE_SCREEN_LEGALLY_APPROVED,
      schema,
      org_setting: {
        row_exists: Boolean(orgSettings),
        live_screen_enabled: Boolean(orgSettings && orgSettings.live_screen_enabled),
      },
      ice_servers: iceServers,
      has_turn: hasTurn,
      active_sessions: liveScreen.activeSessionCount(),
      target,
      viewer: {
        id: req.user.id,
        role: req.user.role,
        is_owner: req.user.role === "owner",
      },
      ready:
        LIVE_SCREEN_LEGALLY_APPROVED &&
        schema.sessions_table &&
        schema.org_setting_column &&
        Boolean(orgSettings && orgSettings.live_screen_enabled),
    });
  } catch (error) {
    console.error("getLiveScreenDiagnostics error:", error);
    return res
      .status(500)
      .json({ message: "Server error.", detail: error.message });
  }
};

// POST /api/monitoring/agent/livescreen/signal
// Body: { agent_uuid, agent_secret, session_id, type, sdp?, candidate? }
//   type: "offer" | "ice" | "connected" | "stopped" | "error"
exports.submitAgentLiveScreenSignal = async (req, res) => {
  try {
    if (!LIVE_SCREEN_LEGALLY_APPROVED) {
      return res.status(501).json({ message: "Live screen is not enabled." });
    }
    const auth = await authenticateAgentFromBody(req.body);
    if (auth.error) {
      return res.status(auth.error.status).json({ message: auth.error.message });
    }
    const { session_id, type, sdp, candidate } = req.body || {};
    const r = liveScreen.agentSignal(auth.agent.id, {
      session_id,
      type,
      sdp,
      candidate,
    });
    if (!r.ok) {
      return res.status(409).json({ message: r.code || "rejected" });
    }
    const d = liveScreen.agentDirective(auth.agent.id);
    return res.status(200).json({
      ok: true,
      action: d.action,
      answer: d.answer || null,
      viewer_ice: d.viewer_ice || [],
    });
  } catch (error) {
    console.error("submitAgentLiveScreenSignal error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

// ===========================================================================
// Screenshot — a SEPARATE feature from Live Screen. No WebRTC anywhere: the
// agent captures one still frame directly (Electron desktopCapturer) and
// uploads it once; this server relays it to the viewer and never persists it
// (see services/monitoringScreenshot.js). Gated by the SAME legal flag as
// Live Screen — both are "someone may see this employee's screen".
// ===========================================================================

// POST /api/monitoring/agent/screenshot
// Body: { agent_uuid, agent_secret }. Returns:
//   { action: "none" } | { action: "capture", request_id }
exports.getAgentScreenshot = async (req, res) => {
  try {
    if (!LIVE_SCREEN_LEGALLY_APPROVED) {
      return res.status(501).json({ message: "Screenshot is not enabled." });
    }
    const auth = await authenticateAgentFromBody(req.body);
    if (auth.error) {
      return res.status(auth.error.status).json({ message: auth.error.message });
    }
    return res.status(200).json(monitoringScreenshot.agentDirective(auth.agent.id));
  } catch (error) {
    console.error("getAgentScreenshot error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

// POST /api/monitoring/agent/screenshot/upload
// Body: { agent_uuid, agent_secret, request_id, image_base64 }
//    or: { agent_uuid, agent_secret, request_id, error: "<short reason>" }
// The decoded image is handed to the in-memory service for a ONE-TIME relay
// to the viewer (see monitoringScreenshot.submitCapture) and is never
// assigned to any variable here beyond that single call — never logged,
// never written to a model, a file, or anywhere else. Do not add logging of
// req.body in this handler.
exports.submitAgentScreenshotCapture = async (req, res) => {
  try {
    if (!LIVE_SCREEN_LEGALLY_APPROVED) {
      return res.status(501).json({ message: "Screenshot is not enabled." });
    }
    const auth = await authenticateAgentFromBody(req.body);
    if (auth.error) {
      return res.status(auth.error.status).json({ message: auth.error.message });
    }

    const { request_id, image_base64, error: captureError } = req.body || {};
    if (typeof request_id !== "string" || !request_id) {
      return res.status(400).json({ message: "request_id is required." });
    }

    if (captureError) {
      const r = monitoringScreenshot.submitCaptureError(
        auth.agent.id,
        request_id,
        String(captureError).slice(0, 40),
      );
      if (!r.ok) return res.status(409).json({ message: r.code || "rejected" });
      return res.status(200).json({ ok: true });
    }

    if (typeof image_base64 !== "string" || !image_base64) {
      return res.status(400).json({ message: "image_base64 is required." });
    }

    let buffer;
    try {
      buffer = Buffer.from(image_base64, "base64");
    } catch {
      return res.status(400).json({ message: "image_base64 is not valid base64." });
    }
    // A generous but bounded cap — nothing this large should ever be a
    // legitimate single-screen PNG; refuse rather than relay something huge.
    if (buffer.length === 0 || buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ message: "image size out of bounds." });
    }

    const r = monitoringScreenshot.submitCapture(auth.agent.id, request_id, buffer);
    if (!r.ok) {
      return res.status(409).json({ message: r.code || "rejected" });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("submitAgentScreenshotCapture error:", error.message);
    return res.status(500).json({ message: "Server error." });
  }
};
