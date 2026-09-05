"use strict";

// Screenshot — a separate feature from Live Screen. One-time capture, no
// WebRTC anywhere. The request registry must NEVER hold image bytes at any
// point in its lifecycle — only the emitted event payload ever carries them,
// for one synchronous tick.

const test = require("node:test");
const assert = require("node:assert/strict");

const ss = require("../services/monitoringScreenshot");

test.afterEach(() => ss._reset());

const OWNER = { id: 1, role: "owner", organization_id: 9 };
const MEMBER = { id: 3, role: "member", organization_id: 9 };
const liveGrant = {
  organization_id: 9,
  grantee_user_id: 3,
  target_user_id: 5,
  expires_at: "2999-01-01T00:00:00Z",
  revoked_at: null,
};

const OK_INPUTS = {
  gateApproved: true,
  viewer: OWNER,
  organizationId: 9,
  targetUserId: 5,
  orgSettings: { live_screen_enabled: true },
  grants: [],
  agent: { id: 42 },
  consent: { id: 1, accepted_at: "2026-09-05T00:00:00Z" },
};

// --- prepareViewerRequest: reuses the same trust boundary as Live Screen ---

test("prepareViewerRequest: happy path -> ok + accessVia + numeric target", () => {
  const r = ss.prepareViewerRequest({ ...OK_INPUTS });
  assert.deepEqual(r, { ok: true, accessVia: "owner", targetUserId: 5 });
});

test("prepareViewerRequest: a specific code for every missing precondition", () => {
  assert.equal(ss.prepareViewerRequest({ ...OK_INPUTS, viewer: { role: "owner" } }).code, "unauthenticated");
  assert.equal(ss.prepareViewerRequest({ ...OK_INPUTS, organizationId: undefined }).code, "unauthenticated");
  assert.equal(ss.prepareViewerRequest({ ...OK_INPUTS, targetUserId: "abc" }).code, "bad_request");
  assert.equal(ss.prepareViewerRequest({ ...OK_INPUTS, gateApproved: false }).code, "not_enabled");
  assert.equal(
    ss.prepareViewerRequest({ ...OK_INPUTS, orgSettings: { live_screen_enabled: false } }).code,
    "not_enabled",
  );
  assert.equal(ss.prepareViewerRequest({ ...OK_INPUTS, orgSettings: null }).code, "not_enabled");
  assert.equal(ss.prepareViewerRequest({ ...OK_INPUTS, viewer: MEMBER, grants: [] }).code, "not_authorized");
  assert.equal(ss.prepareViewerRequest({ ...OK_INPUTS, agent: null }).code, "agent_offline");
  assert.equal(ss.prepareViewerRequest({ ...OK_INPUTS, consent: null }).code, "consent_missing");
});

test("prepareViewerRequest: a non-owner with a live grant is allowed", () => {
  const r = ss.prepareViewerRequest({ ...OK_INPUTS, viewer: MEMBER, grants: [liveGrant] });
  assert.deepEqual(r, { ok: true, accessVia: "grant", targetUserId: 5 });
});

// --- request lifecycle -----------------------------------------------------

function newRequest(over = {}) {
  const id = `r-${Math.random().toString(36).slice(2)}`;
  ss.createRequest({
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

test("agent directive: none -> capture(after request) -> none(after delivered)", () => {
  assert.deepEqual(ss.agentDirective(42), { action: "none" });
  const id = newRequest();
  assert.deepEqual(ss.agentDirective(42), { action: "capture", request_id: id });

  const png = Buffer.from("fake-png-bytes");
  const res = ss.submitCapture(42, id, png);
  assert.deepEqual(res, { ok: true });
  assert.equal(ss.getRequest(id).status, "delivered");
  // request is consumed — no longer offered to the agent
  assert.deepEqual(ss.agentDirective(42), { action: "none" });
});

test("submitCapture delivers the image ONLY as a same-tick event payload, never stored", () => {
  const id = newRequest();
  const events = [];
  ss.emitter.on("request", (e) => events.push(e));

  const png = Buffer.from([1, 2, 3, 4]);
  ss.submitCapture(42, id, png);

  const delivered = events.find((e) => e.type === "delivered");
  assert.ok(delivered, "a 'delivered' event should have fired");
  assert.equal(delivered.imageBuffer, png);
  assert.equal(delivered.mimeType, "image/png");

  // The public view of the request (what every other caller can see) carries
  // no image field at all, at any point — the registry never held the bytes.
  const view = ss.getRequest(id);
  assert.equal(Object.prototype.hasOwnProperty.call(view, "imageBuffer"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(view, "image"), false);
  assert.deepEqual(Object.keys(view).sort(), [
    "accessVia",
    "agentId",
    "deliveredAt",
    "errorReason",
    "id",
    "organizationId",
    "requestedAt",
    "status",
    "targetUserId",
    "viewerUserId",
  ]);
});

test("submitCapture rejects an empty buffer as a capture failure, not a silent success", () => {
  const id = newRequest();
  const res = ss.submitCapture(42, id, Buffer.alloc(0));
  assert.deepEqual(res, { ok: false, code: "empty_capture" });
  assert.equal(ss.getRequest(id).status, "error");
  assert.equal(ss.getRequest(id).errorReason, "empty_capture");
});

test("submitCapture rejects an unknown / mismatched / already-fulfilled request", () => {
  assert.deepEqual(ss.submitCapture(42, "nope", Buffer.from("x")), { ok: false, code: "no_request" });
  assert.deepEqual(ss.submitCapture(999, "nope", Buffer.from("x")), { ok: false, code: "no_request" });

  const id = newRequest();
  ss.submitCapture(42, id, Buffer.from("x"));
  // a second upload for the same (already-delivered) request is rejected
  assert.deepEqual(ss.submitCapture(42, id, Buffer.from("y")), { ok: false, code: "no_request" });
});

test("submitCaptureError fails the request with the given reason", () => {
  const id = newRequest();
  const res = ss.submitCaptureError(42, id, "no_display");
  assert.deepEqual(res, { ok: true });
  assert.equal(ss.getRequest(id).status, "error");
  assert.equal(ss.getRequest(id).errorReason, "no_display");
});

test("request timeout: agent never polls/captures -> fails with agent_unavailable", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const id = newRequest();
  t.mock.timers.tick(21 * 1000); // just past the 20s default
  assert.equal(ss.getRequest(id).status, "error");
  assert.equal(ss.getRequest(id).errorReason, "agent_unavailable");
});

test("activeRequestCount reflects only still-pending requests", () => {
  assert.equal(ss.activeRequestCount(), 0);
  const a = newRequest({ agentId: 1 });
  newRequest({ agentId: 2 });
  assert.equal(ss.activeRequestCount(), 2);
  ss.submitCapture(1, a, Buffer.from("x"));
  assert.equal(ss.activeRequestCount(), 1);
});
