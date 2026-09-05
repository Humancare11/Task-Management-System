"use strict";

// Live Screen — authorization + the in-memory signaling relay. No DB, no media.
// The relay must never retain SDP/ICE after a session ends.

const test = require("node:test");
const assert = require("node:assert/strict");

const ls = require("../services/monitoringLiveScreen");
const gate = require("../config/liveScreenGate");
const consentDoc = require("../config/liveScreenConsentDocument");

test.afterEach(() => ls._reset());

const OWNER = { id: 1, role: "owner", organization_id: 9 };
const MEMBER = { id: 3, role: "member", organization_id: 9 };
const liveGrant = {
  organization_id: 9,
  grantee_user_id: 3,
  target_user_id: 5,
  expires_at: "2999-01-01T00:00:00Z",
  revoked_at: null,
};

// --- legal gate ---------------------------------------------------------

test("the legal gate is open (design approved 2026-09-04)", () => {
  assert.equal(gate.LIVE_SCREEN_LEGALLY_APPROVED, true);
});

test("consent doc: one-time setup notice covering the mandatory safeguards", () => {
  assert.equal(consentDoc.LIVE_SCREEN_CONSENT_DOCUMENT_VERSION, "2026-09-04.ls-v2");
  assert.equal(
    gate.LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
    consentDoc.LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
  );
  const t = consentDoc.LIVE_SCREEN_CONSENT_DOCUMENT_TEXT.toLowerCase();
  for (const phrase of [
    "once", // taken once at setup
    "banner", // mandatory on-screen indicator
    "stop", // employee stop control
    "not recorded", // no recording
    "peer-to-peer",
    "decline",
    "withdraw",
  ]) {
    assert.ok(t.includes(phrase), `notice should mention "${phrase}"`);
  }
});

test("gate closed (test seam) -> not_enabled regardless of role / org / grant", () => {
  const r = ls.authorizeViewer({
    gateApproved: false,
    orgSettings: { live_screen_enabled: true },
    viewer: OWNER,
    organizationId: 9,
    targetUserId: 5,
  });
  assert.deepEqual(r, { ok: false, code: "not_enabled" });
});

// --- authorization (gate + org open) -----------------------------------

test("org not enabled -> not_enabled", () => {
  const r = ls.authorizeViewer({
    gateApproved: true,
    orgSettings: { live_screen_enabled: false },
    viewer: OWNER,
    organizationId: 9,
    targetUserId: 5,
  });
  assert.equal(r.code, "not_enabled");
});

test("owner is authorized (via owner)", () => {
  const r = ls.authorizeViewer({
    gateApproved: true,
    orgSettings: { live_screen_enabled: true },
    viewer: OWNER,
    organizationId: 9,
    targetUserId: 5,
  });
  assert.deepEqual(r, { ok: true, accessVia: "owner" });
});

test("non-owner needs a live, matching grant", () => {
  const base = {
    gateApproved: true,
    orgSettings: { live_screen_enabled: true },
    viewer: MEMBER,
    organizationId: 9,
    targetUserId: 5,
  };
  assert.equal(ls.authorizeViewer({ ...base, grants: [] }).code, "not_authorized");
  assert.deepEqual(ls.authorizeViewer({ ...base, grants: [liveGrant] }), {
    ok: true,
    accessVia: "grant",
  });
  assert.equal(
    ls.authorizeViewer({ ...base, grants: [{ ...liveGrant, revoked_at: "2020-01-01" }] }).code,
    "not_authorized",
  );
  assert.equal(
    ls.authorizeViewer({ ...base, grants: [{ ...liveGrant, expires_at: "2020-01-01" }] }).code,
    "not_authorized",
  );
  assert.equal(
    ls.authorizeViewer({ ...base, grants: [{ ...liveGrant, target_user_id: 999 }] }).code,
    "not_authorized",
  );
});

// --- prepareViewerRequest: one decision, a specific code per failure ---

const OK_INPUTS = {
  gateApproved: true,
  viewer: OWNER,
  organizationId: 9,
  targetUserId: 5,
  orgSettings: { live_screen_enabled: true },
  grants: [],
  agent: { id: 42 },
  consent: { id: 1, accepted_at: "2026-09-04T00:00:00Z" },
};

test("prepareViewerRequest: happy path -> ok + accessVia + numeric target", () => {
  const r = ls.prepareViewerRequest({ ...OK_INPUTS });
  assert.deepEqual(r, { ok: true, accessVia: "owner", targetUserId: 5 });
});

test("prepareViewerRequest: a specific code for every missing precondition", () => {
  assert.equal(
    ls.prepareViewerRequest({ ...OK_INPUTS, viewer: { role: "owner" } }).code,
    "unauthenticated",
  );
  assert.equal(
    ls.prepareViewerRequest({ ...OK_INPUTS, organizationId: undefined }).code,
    "unauthenticated",
  );
  assert.equal(
    ls.prepareViewerRequest({ ...OK_INPUTS, targetUserId: "abc" }).code,
    "bad_request",
  );
  assert.equal(
    ls.prepareViewerRequest({ ...OK_INPUTS, gateApproved: false }).code,
    "not_enabled",
  );
  assert.equal(
    ls.prepareViewerRequest({ ...OK_INPUTS, orgSettings: { live_screen_enabled: false } }).code,
    "not_enabled",
  );
  assert.equal(
    ls.prepareViewerRequest({ ...OK_INPUTS, orgSettings: null }).code,
    "not_enabled",
  );
  assert.equal(
    ls.prepareViewerRequest({ ...OK_INPUTS, viewer: MEMBER, grants: [] }).code,
    "not_authorized",
  );
  assert.equal(
    ls.prepareViewerRequest({ ...OK_INPUTS, agent: null }).code,
    "agent_offline",
  );
  assert.equal(
    ls.prepareViewerRequest({ ...OK_INPUTS, consent: null }).code,
    "consent_missing",
  );
});

test("prepareViewerRequest: a non-owner with a live grant is allowed", () => {
  const r = ls.prepareViewerRequest({
    ...OK_INPUTS,
    viewer: MEMBER,
    grants: [liveGrant],
  });
  assert.deepEqual(r, { ok: true, accessVia: "grant", targetUserId: 5 });
});

test("isSchemaError recognises missing table / column, not other errors", () => {
  assert.equal(
    ls.isSchemaError({ name: "SequelizeDatabaseError", original: { code: "ER_NO_SUCH_TABLE" } }),
    true,
  );
  assert.equal(
    ls.isSchemaError({ name: "SequelizeDatabaseError", original: { code: "ER_BAD_FIELD_ERROR" } }),
    true,
  );
  assert.equal(
    ls.isSchemaError({ name: "SequelizeDatabaseError", original: { code: "ER_DUP_ENTRY" } }),
    false,
  );
  assert.equal(ls.isSchemaError(new Error("boom")), false);
  assert.equal(ls.isSchemaError(null), false);
});

// --- session lifecycle + signaling relay ------------------------------

function newSession(over = {}) {
  const id = `s-${Math.random().toString(36).slice(2)}`;
  ls.createSession({
    id,
    organizationId: 9,
    viewer: OWNER,
    targetUserId: 5,
    agentId: 42,
    accessVia: "owner",
    ...over,
  });
  return id;
}

test("agent directive: none -> start(after request) -> keep(after connected) -> stop(after end)", () => {
  assert.deepEqual(ls.agentDirective(42), { action: "none" });

  const id = newSession();
  let d = ls.agentDirective(42);
  assert.equal(d.action, "start");
  assert.equal(d.session_id, id);
  assert.ok(Array.isArray(d.ice_servers) && d.ice_servers.length);

  ls.agentSignal(42, { session_id: id, type: "offer", sdp: "OFFER_SDP" });
  ls.agentSignal(42, { session_id: id, type: "connected" });
  assert.equal(ls.agentDirective(42).action, "keep");

  ls.endSession(id, "stopped_by_viewer");
  assert.equal(ls.agentDirective(42).action, "stop");
});

test("relay carries offer -> answer -> ICE both ways", () => {
  const id = newSession();
  const events = [];
  ls.emitter.on("session", (e) => events.push(e.type));

  ls.agentSignal(42, { session_id: id, type: "offer", sdp: "OFFER" });
  assert.ok(events.includes("offer"));

  assert.equal(ls.viewerAnswer(id, "ANSWER"), true);
  assert.equal(ls.agentDirective(42).answer, "ANSWER");

  ls.viewerIce(id, "vcand1");
  assert.deepEqual(ls.agentDirective(42).viewer_ice, ["vcand1"]);
  assert.deepEqual(ls.agentDirective(42).viewer_ice, [], "delivered once");

  ls.agentSignal(42, { session_id: id, type: "ice", candidate: "acand1" });
  assert.deepEqual(ls.agentIceFor(id), ["acand1"]);
});

test("ending a session WIPES every signaling artefact", () => {
  const id = newSession();
  ls.agentSignal(42, { session_id: id, type: "offer", sdp: "OFFER" });
  ls.viewerAnswer(id, "ANSWER");
  ls.viewerIce(id, "vcand");
  ls.agentSignal(42, { session_id: id, type: "ice", candidate: "acand" });

  ls.endSession(id, "stopped_by_viewer");

  const d = ls.agentDirective(42);
  assert.equal(d.action, "stop");
  assert.equal(d.answer, undefined);
  assert.equal(ls.agentIceFor(id).length, 0);
  assert.equal(ls.viewerAnswer(id, "LATE"), false);
  assert.equal(ls.viewerIce(id, "LATE"), false);
});

test("endSession is idempotent and emits once", () => {
  const id = newSession();
  let ended = 0;
  ls.emitter.on("session", (e) => {
    if (e.type === "ended") ended += 1;
  });
  ls.endSession(id, "stopped_by_viewer");
  ls.endSession(id, "error");
  ls.endSession(id, "timeout");
  assert.equal(ended, 1);
});

test("a new session for the same target supersedes the old one", () => {
  const a = newSession();
  let supersededReason = null;
  ls.emitter.on("session", (e) => {
    if (e.type === "ended" && e.session.id === a) supersededReason = e.reason;
  });
  const b = newSession();
  assert.equal(supersededReason, "superseded");
  assert.equal(ls.getSession(a) && ls.getSession(a).status, "ended");
  assert.equal(ls.getSession(b).status, "requested");
});

test("agentSignal rejects an unknown / mismatched session", () => {
  newSession();
  assert.deepEqual(ls.agentSignal(42, { session_id: "nope", type: "offer" }), {
    ok: false,
    code: "no_session",
  });
  assert.deepEqual(ls.agentSignal(999, { session_id: "x", type: "offer" }), {
    ok: false,
    code: "no_session",
  });
});

test("connect timeout: offer but no 'connected' -> ends with connect_failed", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = newSession();
  ls.agentSignal(42, { session_id: id, type: "offer", sdp: "OFFER" });
  assert.equal(ls.getSession(id).status, "connecting");
  t.mock.timers.tick(41 * 1000);
  const s = ls.getSession(id);
  assert.ok(s && (s.status === "ended" || s.status === "error"));
  assert.equal(s.endReason, "connect_failed");
});

test("connect timeout is cleared once the peer connects", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = newSession();
  ls.agentSignal(42, { session_id: id, type: "offer", sdp: "OFFER" });
  ls.agentSignal(42, { session_id: id, type: "connected" });
  t.mock.timers.tick(2 * 60 * 1000);
  assert.equal(ls.getSession(id).status, "live");
});

test("STUN-only default is returned when LIVE_SCREEN_ICE_SERVERS is unset", () => {
  const saved = process.env.LIVE_SCREEN_ICE_SERVERS;
  delete process.env.LIVE_SCREEN_ICE_SERVERS;
  const servers = ls.iceServers();
  if (saved !== undefined) process.env.LIVE_SCREEN_ICE_SERVERS = saved;
  assert.ok(Array.isArray(servers) && servers.length >= 1);
  assert.ok(
    servers.every((s) =>
      [].concat(s.urls).every((u) => String(u).startsWith("stun:")),
    ),
    "default is STUN-only",
  );
});

test("LIVE_SCREEN_ICE_SERVERS with a TURN entry is passed through", () => {
  const saved = process.env.LIVE_SCREEN_ICE_SERVERS;
  process.env.LIVE_SCREEN_ICE_SERVERS = JSON.stringify([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "turn:turn.example.com:3478", username: "u", credential: "p" },
  ]);
  const servers = ls.iceServers();
  if (saved === undefined) delete process.env.LIVE_SCREEN_ICE_SERVERS;
  else process.env.LIVE_SCREEN_ICE_SERVERS = saved;
  assert.equal(servers.length, 2);
  assert.equal(servers[1].urls, "turn:turn.example.com:3478");
});

test("endAllForViewer tears down every session that viewer opened", () => {
  ls.createSession({
    id: "v1",
    organizationId: 9,
    viewer: OWNER,
    targetUserId: 5,
    agentId: 1,
    accessVia: "owner",
  });
  ls.createSession({
    id: "v2",
    organizationId: 9,
    viewer: OWNER,
    targetUserId: 6,
    agentId: 2,
    accessVia: "owner",
  });
  ls.endAllForViewer(OWNER.id, "viewer_disconnected");
  assert.equal(ls.getSession("v1").status, "ended");
  assert.equal(ls.getSession("v2").status, "ended");
});

// --- no automatic max-duration cap by default ---------------------------

test("a session has no automatic max-duration cutoff by default", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = newSession();
  ls.agentSignal(42, { session_id: id, type: "offer", sdp: "OFFER" });
  ls.agentSignal(42, { session_id: id, type: "connected" });
  // Well past the old 30-minute default and then some.
  t.mock.timers.tick(6 * 60 * 60 * 1000);
  assert.equal(ls.getSession(id).status, "live");
});

// --- viewer disconnect grace period --------------------------------------

test("a viewer disconnect does not end the session before the grace period", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = newSession();
  ls.scheduleViewerDisconnect(OWNER.id, "viewer_disconnected");
  t.mock.timers.tick(5 * 1000); // well under the 20s grace window
  assert.notEqual(ls.getSession(id).status, "ended");
});

test("reconnecting within the grace period cancels the scheduled end", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = newSession();
  ls.agentSignal(42, { session_id: id, type: "offer", sdp: "OFFER" }); // clears the 45s request timeout
  ls.agentSignal(42, { session_id: id, type: "connected" }); // clears the connect timeout
  ls.scheduleViewerDisconnect(OWNER.id, "viewer_disconnected");
  ls.cancelScheduledViewerDisconnect(OWNER.id); // the "connection" handler does this
  t.mock.timers.tick(5 * 60 * 1000); // long past the grace window, session unaffected
  assert.equal(ls.getSession(id).status, "live");
});

test("a disconnect that outlasts the grace period does end the session", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = newSession();
  ls.scheduleViewerDisconnect(OWNER.id, "viewer_disconnected");
  t.mock.timers.tick(21 * 1000); // just past the 20s default grace window
  assert.equal(ls.getSession(id).status, "ended");
  assert.equal(ls.getSession(id).endReason, "viewer_disconnected");
});

test("scheduling a second disconnect for the same viewer replaces the first timer", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = newSession();
  ls.scheduleViewerDisconnect(OWNER.id, "viewer_disconnected");
  t.mock.timers.tick(15 * 1000);
  ls.scheduleViewerDisconnect(OWNER.id, "viewer_disconnected"); // re-armed, not stacked
  t.mock.timers.tick(15 * 1000); // 30s total, but only 15s since the re-arm
  assert.notEqual(ls.getSession(id).status, "ended");
  t.mock.timers.tick(10 * 1000); // now 25s since the re-arm
  assert.equal(ls.getSession(id).status, "ended");
});
