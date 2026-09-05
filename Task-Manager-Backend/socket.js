const crypto = require("crypto");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { sequelize } = require("./config/db");
const {
  Project,
  Task,
  MonitoringAgent,
  MonitoringOrgSetting,
  MonitoringContentGrant,
  MonitoringConsent,
  MonitoringLiveScreenSession,
} = require("./models");
const liveScreen = require("./services/monitoringLiveScreen");
const {
  LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
} = require("./config/liveScreenConsentDocument");
const { LIVE_SCREEN_LEGALLY_APPROVED } = require("./config/liveScreenGate");

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("No token provided."));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, organization_id, role }
      next();
    } catch (error) {
      next(new Error("Invalid or expired token."));
    }
  });

  io.on("connection", (socket) => {
    // Personal room — used for direct notifications
    socket.join(`user:${socket.user.id}`);

    // This user reconnected (new tab, or the same tab's transport recovered
    // from a blip) — cancel any pending "end their Live Screen session(s)"
    // grace timer from a previous disconnect so a brief network hiccup never
    // kills a live call.
    liveScreen.cancelScheduledViewerDisconnect(socket.user.id);

    // Organization room — used for the org-wide activity feed. The id comes
    // from the verified JWT (socket.user), never from a client message, so a
    // client cannot subscribe to another organization's activity.
    if (socket.user.organization_id) {
      socket.join(`organization:${socket.user.organization_id}`);
    }

    socket.on("project:join", async (projectId) => {
      try {
        const project = await Project.findOne({
          where: { id: projectId, organization_id: socket.user.organization_id },
        });
        if (project) {
          socket.join(`project:${projectId}`);
        }
      } catch (err) {
        console.error("project:join error:", err.message);
      }
    });

    socket.on("project:leave", (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on("task:join", async (taskId) => {
      try {
        const task = await Task.findOne({
          where: { id: taskId, organization_id: socket.user.organization_id },
        });
        if (task) {
          socket.join(`task:${taskId}`);
        }
      } catch (err) {
        console.error("task:join error:", err.message);
      }
    });

    socket.on("task:leave", (taskId) => {
      socket.leave(`task:${taskId}`);
    });

    wireLiveScreenSocket(socket);
  });

  wireLiveScreenRelay();
  reportLiveScreenReadiness();

  return io;
}

// Boot-time check: the Live Screen migrations (monitoring_live_screen_sessions +
// monitoring_org_settings.live_screen_enabled) ship in code but only run via
// `npm run migrate:prod`. On a Passenger host that is NOT executed on deploy,
// so the tables can be missing — which surfaces later as a "server error" when
// a viewer clicks Live Screen. Make that loud at startup instead.
async function reportLiveScreenReadiness() {
  if (!LIVE_SCREEN_LEGALLY_APPROVED) {
    console.log("[live-screen] legal gate is closed — feature disabled.");
    return;
  }
  try {
    const h = await liveScreen.schemaHealth(sequelize);
    if (h.sessions_table && h.org_setting_column) {
      console.log("[live-screen] enabled; schema OK.");
      return;
    }
    console.error(
      "\n" +
        "  ┌─────────────────────────────────────────────────────────────────┐\n" +
        "  │  LIVE SCREEN SCHEMA IS MISSING — the feature will fail.          │\n" +
        `  │   monitoring_live_screen_sessions table : ${h.sessions_table ? "present" : "MISSING "}              │\n` +
        `  │   monitoring_org_settings.live_screen_enabled : ${h.org_setting_column ? "present" : "MISSING "}       │\n` +
        "  │  Run the pending migrations on this database:                    │\n" +
        "  │    npx sequelize-cli db:migrate --env production                 │\n" +
        "  └─────────────────────────────────────────────────────────────────┘\n",
    );
  } catch (err) {
    console.error("[live-screen] schema check failed:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Live Screen — WebRTC signaling for the VIEWER side. The media never touches
// this server; only SDP/ICE text is relayed, and only while a session is open.
// Gated by config/liveScreenGate.js (LIVE_SCREEN_LEGALLY_APPROVED).
// ---------------------------------------------------------------------------

let liveScreenRelayWired = false;

function wireLiveScreenRelay() {
  if (liveScreenRelayWired) return;
  liveScreenRelayWired = true;

  liveScreen.emitter.on("session", async (evt) => {
    const s = evt.session;
    const room = s.viewerUserId ? `user:${s.viewerUserId}` : null;

    // keep the audit row's status column in step (metadata only)
    try {
      if (evt.type === "offer") {
        await MonitoringLiveScreenSession.update(
          { status: "connecting" },
          { where: { id: s.id } },
        );
      } else if (evt.type === "live") {
        await MonitoringLiveScreenSession.update(
          { status: "live", connected_at: new Date() },
          { where: { id: s.id } },
        );
      } else if (evt.type === "ended") {
        await MonitoringLiveScreenSession.update(
          {
            status: s.status === "error" ? "error" : "ended",
            end_reason: evt.reason || s.endReason || "ended",
            ended_at: new Date(),
          },
          { where: { id: s.id, status: { [Op.notIn]: ["ended", "error"] } } },
        );
      }
    } catch (err) {
      console.error("live-screen audit update failed:", err.message);
    }

    if (!room || !io) return;
    if (evt.type === "offer") {
      io.to(room).emit("livescreen:offer", { sessionId: s.id, sdp: evt.sdp });
    } else if (evt.type === "ice") {
      io.to(room).emit("livescreen:ice", {
        sessionId: s.id,
        candidate: evt.candidate,
      });
    } else if (evt.type === "live") {
      io.to(room).emit("livescreen:status", { sessionId: s.id, status: "live" });
    } else if (evt.type === "ended") {
      io.to(room).emit("livescreen:ended", {
        sessionId: s.id,
        reason: evt.reason || s.endReason || "ended",
      });
    }
  });
}

function wireLiveScreenSocket(socket) {
  const user = socket.user; // { id, organization_id, role } from verified JWT

  socket.on("livescreen:request", async ({ targetUserId } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const target = Number(targetUserId);
    try {
      const [orgSettings, grants, agent, consent] = await Promise.all([
        MonitoringOrgSetting.findOne({
          where: { organization_id: user.organization_id },
          attributes: ["organization_id", "live_screen_enabled"],
          raw: true,
        }),
        MonitoringContentGrant.findAll({
          where: { organization_id: user.organization_id, grantee_user_id: user.id },
          raw: true,
        }),
        Number.isInteger(target) && target > 0
          ? MonitoringAgent.findOne({
              where: {
                organization_id: user.organization_id,
                user_id: target,
                status: "active",
              },
              order: [["last_seen_at", "DESC"]],
            })
          : null,
        Number.isInteger(target) && target > 0
          ? MonitoringConsent.findOne({
              where: {
                user_id: target,
                document_version: LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
              },
              raw: true,
            })
          : null,
      ]);

      const decision = liveScreen.prepareViewerRequest({
        viewer: user,
        organizationId: user.organization_id,
        targetUserId: target,
        orgSettings,
        grants,
        agent,
        consent,
      });
      if (!decision.ok) return reply({ ok: false, code: decision.code });

      const id = crypto.randomUUID();
      await MonitoringLiveScreenSession.create({
        id,
        organization_id: user.organization_id,
        viewer_user_id: user.id,
        target_user_id: target,
        agent_id: agent.id,
        status: "requested",
        access_via: decision.accessVia,
        viewer_ip:
          (socket.handshake.headers["x-forwarded-for"] || "")
            .split(",")[0]
            .trim() ||
          socket.handshake.address ||
          null,
      });

      liveScreen.createSession({
        id,
        organizationId: user.organization_id,
        viewer: user,
        targetUserId: target,
        agentId: agent.id,
        accessVia: decision.accessVia,
      });

      reply({ ok: true, sessionId: id, iceServers: liveScreen.iceServers() });
    } catch (err) {
      // Full detail in the log so the exact cause is visible, not just .message.
      console.error("livescreen:request FAILED", {
        viewer: user && user.id,
        org: user && user.organization_id,
        target,
        name: err && err.name,
        db_code: err && err.original && err.original.code,
        sql: err && err.sql,
        message: err && err.message,
      });
      if (liveScreen.isSchemaError(err)) {
        return reply({
          ok: false,
          code: "not_ready",
          detail:
            "Live Screen database migrations have not been applied on this server. " +
            "Run: npx sequelize-cli db:migrate --env production",
        });
      }
      reply({ ok: false, code: "server_error" });
    }
  });

  socket.on("livescreen:answer", ({ sessionId, sdp } = {}) => {
    const s = liveScreen.getSession(sessionId);
    if (!s || s.viewerUserId !== user.id) return;
    liveScreen.viewerAnswer(sessionId, sdp);
    // hand the viewer any ICE the agent already produced
    for (const candidate of liveScreen.agentIceFor(sessionId)) {
      socket.emit("livescreen:ice", { sessionId, candidate });
    }
  });

  socket.on("livescreen:ice", ({ sessionId, candidate } = {}) => {
    const s = liveScreen.getSession(sessionId);
    if (!s || s.viewerUserId !== user.id) return;
    liveScreen.viewerIce(sessionId, candidate);
  });

  socket.on("livescreen:stop", ({ sessionId } = {}) => {
    const s = liveScreen.getSession(sessionId);
    if (!s || s.viewerUserId !== user.id) return;
    liveScreen.endSession(sessionId, "stopped_by_viewer");
  });

  socket.on("disconnect", () => {
    // Don't end the session on the spot — the signaling socket dropping is
    // not the same as the viewer wanting to stop (WiFi blip, sleep, a proxy
    // idling the websocket). Give them DISCONNECT_GRACE_MS to reconnect;
    // "connection" above cancels this if they do. The WebRTC media itself is
    // a separate P2P path and is untouched by this socket dropping.
    liveScreen.scheduleViewerDisconnect(user.id, "viewer_disconnected");
  });
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket first.");
  }
  return io;
}

module.exports = { initSocket, getIO };
