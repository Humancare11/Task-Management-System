"use strict";

/**
 * Screenshot — a SEPARATE feature from Live Screen. One-time, on-demand
 * capture of a single still frame of an employee's screen, delivered once to
 * the requesting viewer. It has NO WebRTC dependency anywhere: the agent
 * captures the frame with Electron's desktopCapturer (no video stream, no
 * ICE/STUN/TURN, no peer connection at all), so it works even when Live
 * Screen's WebRTC path cannot connect.
 *
 * IMPORTANT DIFFERENCE FROM LIVE SCREEN'S GUARANTEE: Live Screen's video is
 * peer-to-peer and never touches this server. A Screenshot's image BYTES
 * necessarily transit this server's memory (there is no other transport that
 * is independent of a peer-to-peer connection), because the whole point of
 * this feature is to keep working when a direct agent<->viewer connection
 * cannot be established. What this module guarantees instead is that those
 * bytes are NEVER persisted: they are never assigned to a field on the
 * long-lived `requests` registry, never written to a Sequelize model, a file,
 * or a log line — only ever passed as a same-tick event payload from
 * submitCapture() to whatever is listening (socket.js relays it to the viewer
 * and immediately discards its own reference). Only request METADATA (who,
 * whom, when, outcome) is written to monitoring_screenshot_requests.
 *
 * Reuses the SAME trust boundary as Live Screen on purpose (same org setting,
 * same legal gate, same owner/grant authorization, same consent version) —
 * from an employee's point of view "someone may see my screen" is one
 * permission, whether live or a single frame.
 */

const { EventEmitter } = require("events");
const { LIVE_SCREEN_LEGALLY_APPROVED } = require("../config/liveScreenGate");
const { canViewContent } = require("./monitoringContent");

const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
// How long the agent has to even acknowledge (start capturing) a request.
const REQUEST_TIMEOUT_MS = num(process.env.SCREENSHOT_REQUEST_TIMEOUT_MS, 20 * 1000);
// How long a fulfilled-but-not-yet-relayed record is kept (metadata only —
// see module doc; the image itself is never held here at any point).
const DELIVERED_GRACE_MS = 15 * 1000;

const requests = new Map(); // id -> request (metadata only, never image bytes)
const emitter = new EventEmitter();

function byAgent(agentId) {
  for (const r of requests.values()) {
    if (r.agentId === agentId && r.status === "requested") return r;
  }
  return null;
}

/**
 * Pure end-to-end check of one viewer request — the SAME gates as Live
 * Screen: legal gate, per-org live_screen_enabled, owner/grant authorization,
 * agent online, employee consent on file.
 * @returns {{ok:true, accessVia:"owner"|"grant", targetUserId:number} | {ok:false, code:string}}
 */
function prepareViewerRequest(p) {
  const viewer = p.viewer || {};
  if (!viewer.id || !p.organizationId) return { ok: false, code: "unauthenticated" };

  const targetUserId = Number(p.targetUserId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return { ok: false, code: "bad_request" };
  }

  const gateApproved =
    p.gateApproved !== undefined ? p.gateApproved : LIVE_SCREEN_LEGALLY_APPROVED;
  if (!gateApproved) return { ok: false, code: "not_enabled" };
  if (!p.orgSettings || !p.orgSettings.live_screen_enabled) {
    return { ok: false, code: "not_enabled" };
  }

  const verdict = canViewContent({
    viewerUserId: viewer.id,
    viewerRole: viewer.role,
    organizationId: p.organizationId,
    targetUserId,
    grants: p.grants || [],
    now: p.now || new Date(),
  });
  if (!verdict.allowed) return { ok: false, code: "not_authorized" };

  if (!p.agent) return { ok: false, code: "agent_offline" };
  if (!p.consent) return { ok: false, code: "consent_missing" };

  return { ok: true, accessVia: verdict.via, targetUserId };
}

function clearTimers(r) {
  if (r.timers.request) clearTimeout(r.timers.request);
  r.timers = {};
}

function publicView(r) {
  return {
    id: r.id,
    organizationId: r.organizationId,
    viewerUserId: r.viewerUserId,
    targetUserId: r.targetUserId,
    agentId: r.agentId,
    status: r.status,
    accessVia: r.accessVia,
    errorReason: r.errorReason || null,
    requestedAt: r.requestedAt,
    deliveredAt: r.deliveredAt || null,
  };
}

/** End a request with a failure reason (agent never responded, denied, error). */
function failRequest(id, code) {
  const r = requests.get(id);
  if (!r || r.status !== "requested") return;
  clearTimers(r);
  r.status = code === "denied" ? "denied" : "error";
  r.errorReason = code;
  emitter.emit("request", { type: "failed", request: publicView(r), code });
  setTimeout(() => requests.delete(id), DELIVERED_GRACE_MS).unref?.();
}

/**
 * Register a new viewer-initiated request. Caller has already run
 * prepareViewerRequest(). `agentId` is the target's active agent.
 */
function createRequest({ id, organizationId, viewer, targetUserId, agentId, accessVia }) {
  const r = {
    id,
    organizationId,
    viewerUserId: viewer.id,
    targetUserId,
    agentId,
    accessVia,
    status: "requested",
    requestedAt: new Date(),
    deliveredAt: null,
    errorReason: null,
    timers: {},
  };
  r.timers.request = setTimeout(() => failRequest(id, "agent_unavailable"), REQUEST_TIMEOUT_MS);
  if (r.timers.request.unref) r.timers.request.unref();

  requests.set(id, r);
  emitter.emit("request", { type: "requested", request: publicView(r) });
  return publicView(r);
}

// ---- agent side (polled directive + upload) ------------------------------

/** Is there a pending capture request for this agent right now? */
function agentDirective(agentId) {
  const r = byAgent(agentId);
  if (!r) return { action: "none" };
  return { action: "capture", request_id: r.id };
}

/**
 * Agent uploads the captured PNG. `imageBuffer` is used ONLY as a same-tick
 * event payload here — it is never assigned onto the long-lived request
 * record, so there is nothing to "clean up" afterwards; once this function
 * returns, no reference to the image survives anywhere in this module.
 */
function submitCapture(agentId, requestId, imageBuffer) {
  const r = requests.get(requestId);
  if (!r || r.agentId !== agentId || r.status !== "requested") {
    return { ok: false, code: "no_request" };
  }
  if (!imageBuffer || !imageBuffer.length) {
    failRequest(requestId, "empty_capture");
    return { ok: false, code: "empty_capture" };
  }
  clearTimers(r);
  r.status = "delivered";
  r.deliveredAt = new Date();
  emitter.emit("request", {
    type: "delivered",
    request: publicView(r),
    imageBuffer,
    mimeType: "image/png",
  });
  setTimeout(() => requests.delete(requestId), DELIVERED_GRACE_MS).unref?.();
  return { ok: true };
}

/** Agent reports it could not capture (e.g. no display, permission denied). */
function submitCaptureError(agentId, requestId, reason) {
  const r = requests.get(requestId);
  if (!r || r.agentId !== agentId) return { ok: false, code: "no_request" };
  failRequest(requestId, reason || "capture_failed");
  return { ok: true };
}

function getRequest(id) {
  const r = requests.get(id);
  return r ? publicView(r) : null;
}

function activeRequestCount() {
  let n = 0;
  for (const r of requests.values()) if (r.status === "requested") n += 1;
  return n;
}

function _reset() {
  for (const r of requests.values()) clearTimers(r);
  requests.clear();
  emitter.removeAllListeners();
}

module.exports = {
  emitter,
  prepareViewerRequest,
  createRequest,
  failRequest,
  agentDirective,
  submitCapture,
  submitCaptureError,
  getRequest,
  activeRequestCount,
  REQUEST_TIMEOUT_MS,
  _reset,
};
