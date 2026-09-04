"use strict";

/**
 * Live Screen — session registry + WebRTC signaling relay.
 *
 * NOTHING here touches media. The registry holds, per active session, only the
 * transient SDP offer/answer and ICE candidate strings needed to broker one
 * peer-to-peer connection. Every entry is deleted on teardown. Video flows
 * agent -> viewer directly and never reaches this process.
 *
 * Split like the other monitoring services:
 *   - authorizeViewer()   pure — gate + org setting + owner/grant check
 *   - the registry (Map) + EventEmitter — in-memory only, wired to socket.io
 *     and the DB status column by the caller (socket.js / controller)
 */

const { EventEmitter } = require("events");
const { LIVE_SCREEN_LEGALLY_APPROVED } = require("../config/liveScreenGate");
const { canViewContent } = require("./monitoringContent");

const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
const MAX_SESSION_MS = num(process.env.LIVE_SCREEN_MAX_SESSION_MS, 30 * 60 * 1000);
const REQUEST_TIMEOUT_MS = num(process.env.LIVE_SCREEN_REQUEST_TIMEOUT_MS, 45 * 1000);
const ENDED_GRACE_MS = 15 * 1000; // keep an ended session briefly so a late poll sees "stop"

/** ICE/TURN servers for both peers. Configure LIVE_SCREEN_ICE_SERVERS as a JSON
 * array of RTCIceServer objects for production NAT traversal (a TURN server is
 * required when peers are on restrictive networks). */
function iceServers() {
  const raw = process.env.LIVE_SCREEN_ICE_SERVERS;
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through to default */
    }
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

// sessionId -> session
const sessions = new Map();
const emitter = new EventEmitter();

// Any session for this agent — including one that just ended (kept for
// ENDED_GRACE_MS so the agent's next poll sees "stop"). Prefers a live one.
function byAgent(agentId) {
  let ended = null;
  for (const s of sessions.values()) {
    if (s.agentId !== agentId) continue;
    if (s.status === "ended" || s.status === "error") ended = ended || s;
    else return s;
  }
  return ended;
}
function activeByTarget(organizationId, targetUserId) {
  for (const s of sessions.values()) {
    if (
      s.organizationId === organizationId &&
      s.targetUserId === targetUserId &&
      s.status !== "ended" &&
      s.status !== "error"
    ) {
      return s;
    }
  }
  return null;
}

/**
 * Pure authorization for starting a live-screen session.
 * @returns {{ ok:true, accessVia:"owner"|"grant" } | { ok:false, code:string }}
 */
function authorizeViewer(p) {
  const gateApproved =
    p.gateApproved !== undefined ? p.gateApproved : LIVE_SCREEN_LEGALLY_APPROVED;
  if (!gateApproved) return { ok: false, code: "not_enabled" };
  if (!p.orgSettings || !p.orgSettings.live_screen_enabled) {
    return { ok: false, code: "not_enabled" };
  }

  const verdict = canViewContent({
    viewerUserId: p.viewer.id,
    viewerRole: p.viewer.role,
    organizationId: p.organizationId,
    targetUserId: p.targetUserId,
    grants: p.grants || [],
    now: p.now || new Date(),
  });
  if (!verdict.allowed) return { ok: false, code: "not_authorized" };
  return { ok: true, accessVia: verdict.via };
}

function clearTimers(s) {
  if (s.timers.request) clearTimeout(s.timers.request);
  if (s.timers.max) clearTimeout(s.timers.max);
  s.timers = {};
}

/** End a session and drop every transient signaling artefact. Idempotent. */
function endSession(sessionId, reason) {
  const s = sessions.get(sessionId);
  if (!s || s.status === "ended" || s.status === "error") return;
  clearTimers(s);
  s.status = reason === "error" ? "error" : "ended";
  s.endReason = reason;
  s.endedAt = new Date();
  s.signal = { offer: null, answer: null, viewerIce: [], agentIce: [] }; // wiped
  emitter.emit("session", { type: "ended", session: publicView(s), reason });
  setTimeout(() => sessions.delete(sessionId), ENDED_GRACE_MS).unref?.();
}

function publicView(s) {
  return {
    id: s.id,
    organizationId: s.organizationId,
    viewerUserId: s.viewerUserId,
    targetUserId: s.targetUserId,
    agentId: s.agentId,
    status: s.status,
    accessVia: s.accessVia,
    endReason: s.endReason || null,
    connectedAt: s.connectedAt || null,
    endedAt: s.endedAt || null,
  };
}

/**
 * Register a new viewer-initiated session. Caller has already run
 * authorizeViewer(). `agentId` is the target's active agent.
 */
function createSession({ id, organizationId, viewer, targetUserId, agentId, accessVia }) {
  // one live session per target at a time
  const existing = activeByTarget(organizationId, targetUserId);
  if (existing) endSession(existing.id, "superseded");

  const s = {
    id,
    organizationId,
    viewerUserId: viewer.id,
    targetUserId,
    agentId,
    accessVia,
    status: "requested",
    createdAt: new Date(),
    connectedAt: null,
    signal: { offer: null, answer: null, viewerIce: [], agentIce: [] },
    timers: {},
  };
  s.timers.request = setTimeout(
    () => endSession(id, "agent_unavailable"),
    REQUEST_TIMEOUT_MS,
  );
  s.timers.max = setTimeout(() => endSession(id, "max_duration"), MAX_SESSION_MS);
  if (s.timers.request.unref) s.timers.request.unref();
  if (s.timers.max.unref) s.timers.max.unref();

  sessions.set(id, s);
  emitter.emit("session", { type: "requested", session: publicView(s) });
  return publicView(s);
}

// ---- agent side (polled directive + posted signal) ----------------------

/** What the agent for `agentId` should do right now. */
function agentDirective(agentId) {
  const s = byAgent(agentId);
  if (!s) return { action: "none" };
  if (s.status === "requested" || s.status === "connecting") {
    return {
      action: "start",
      session_id: s.id,
      ice_servers: iceServers(),
      answer: s.signal.answer || null,
      viewer_ice: s.signal.viewerIce.splice(0), // deliver once
    };
  }
  if (s.status === "live") {
    return {
      action: "keep",
      session_id: s.id,
      viewer_ice: s.signal.viewerIce.splice(0),
    };
  }
  return { action: "stop", session_id: s.id };
}

/** Agent posts an offer / ICE / status update. */
function agentSignal(agentId, msg) {
  const s = byAgent(agentId);
  if (!s || !msg || msg.session_id !== s.id) return { ok: false, code: "no_session" };

  switch (msg.type) {
    case "offer":
      if (s.timers.request) {
        clearTimeout(s.timers.request);
        s.timers.request = null;
      }
      s.status = "connecting";
      s.signal.offer = msg.sdp || null;
      emitter.emit("session", { type: "offer", session: publicView(s), sdp: msg.sdp });
      return { ok: true };
    case "ice":
      if (msg.candidate) s.signal.agentIce.push(msg.candidate);
      emitter.emit("session", {
        type: "ice",
        session: publicView(s),
        candidate: msg.candidate,
      });
      return { ok: true };
    case "connected":
      if (s.status !== "live") {
        s.status = "live";
        s.connectedAt = new Date();
        emitter.emit("session", { type: "live", session: publicView(s) });
      }
      return { ok: true };
    case "stopped":
      endSession(s.id, "stopped_by_employee");
      return { ok: true };
    case "error":
      endSession(s.id, "error");
      return { ok: true };
    default:
      return { ok: false, code: "bad_type" };
  }
}

// ---- viewer side (socket.io) -------------------------------------------

function viewerAnswer(sessionId, sdp) {
  const s = sessions.get(sessionId);
  if (!s || s.status === "ended" || s.status === "error") return false;
  s.signal.answer = sdp || null;
  return true;
}
function viewerIce(sessionId, candidate) {
  const s = sessions.get(sessionId);
  if (!s || s.status === "ended" || s.status === "error") return false;
  if (candidate) s.signal.viewerIce.push(candidate);
  return true;
}
function agentIceFor(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return [];
  return s.signal.agentIce.splice(0);
}
function getSession(sessionId) {
  const s = sessions.get(sessionId);
  return s ? publicView(s) : null;
}
function endAllForViewer(viewerUserId, reason = "viewer_disconnected") {
  for (const s of [...sessions.values()]) {
    if (s.viewerUserId === viewerUserId) endSession(s.id, reason);
  }
}

function _reset() {
  for (const s of sessions.values()) clearTimers(s);
  sessions.clear();
  emitter.removeAllListeners();
}

module.exports = {
  emitter,
  iceServers,
  authorizeViewer,
  createSession,
  endSession,
  agentDirective,
  agentSignal,
  viewerAnswer,
  viewerIce,
  agentIceFor,
  getSession,
  endAllForViewer,
  MAX_SESSION_MS,
  _reset,
};
