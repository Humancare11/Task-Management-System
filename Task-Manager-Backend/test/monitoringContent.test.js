"use strict";

// §5b captured-content safeguards. The five hard gates, each proven to fail
// CLOSED. No DB — pure functions + injected fakes (same style as
// monitoringDerivation.test.js / monitoringRecomputeRunner.test.js).

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const mc = require("../services/monitoringContent");
const cc = require("../utils/contentCrypto");

function setEnv(vars) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  cc._resetCache();
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    cc._resetCache();
  };
}
function withEnv(vars, fn) {
  const restore = setEnv(vars);
  try {
    return fn();
  } finally {
    restore();
  }
}
async function withEnvAsync(vars, fn) {
  const restore = setEnv(vars);
  try {
    return await fn();
  } finally {
    restore();
  }
}
const KEYS = JSON.stringify({ v1: crypto.randomBytes(32).toString("base64") });

const baseItem = (over = {}) => ({
  client_event_id: crypto.randomUUID(),
  app: "Google Chrome",
  kind: "search",
  text: "how to center a div",
  domain: "google.com",
  captured_at: "2026-09-03T10:00:00.000Z",
  ...over,
});

const okEvalArgs = (over = {}) => ({
  gateApproved: true,
  keysConfigured: true,
  orgEnabled: true,
  hasConsent: true,
  items: [baseItem()],
  blocklistPatterns: null,
  retentionDays: 30,
  now: new Date("2026-09-03T10:05:00.000Z"),
  ...over,
});

// ---------------------------------------------------------------------------
// retention clamp
// ---------------------------------------------------------------------------

test("retentionDays clamps to [30, 90], default 30", () => {
  assert.equal(mc.retentionDays(undefined), 30);
  assert.equal(mc.retentionDays(0), 30);
  assert.equal(mc.retentionDays(15), 30);
  assert.equal(mc.retentionDays(45), 45);
  assert.equal(mc.retentionDays(120), 90);
  assert.equal(mc.retentionDays("60"), 60);
  assert.equal(mc.retentionDays(NaN), 30);
});

test("expiresAtFor = captured_at + N days", () => {
  const exp = mc.expiresAtFor(new Date("2026-09-03T10:00:00Z"), 30);
  assert.equal(exp.toISOString(), "2026-10-03T10:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Safeguard 0 — legal gate
// ---------------------------------------------------------------------------

test("gate closed -> 501, nothing evaluated", () => {
  const r = mc.evaluateIngest(okEvalArgs({ gateApproved: false }));
  assert.equal(r.status, 501);
  assert.equal(r.rows.length, 0);
});

// ---------------------------------------------------------------------------
// Safeguard 3 — encryption must be configured
// ---------------------------------------------------------------------------

test("no encryption keys -> 503, nothing stored", () => {
  const r = mc.evaluateIngest(okEvalArgs({ keysConfigured: false }));
  assert.equal(r.status, 503);
  assert.equal(r.rows.length, 0);
});

// ---------------------------------------------------------------------------
// Safeguard 1 — org opt-in + consent
// ---------------------------------------------------------------------------

test("org has not enabled capture -> 403, nothing stored", () => {
  const r = mc.evaluateIngest(okEvalArgs({ orgEnabled: false }));
  assert.equal(r.status, 403);
  assert.equal(r.code, "org_disabled");
  assert.equal(r.rows.length, 0);
});

test("NO CONSENT -> ingest rejected (403), nothing stored", () => {
  const r = mc.evaluateIngest(okEvalArgs({ hasConsent: false }));
  assert.equal(r.status, 403);
  assert.equal(r.code, "no_consent");
  assert.equal(r.rows.length, 0);
});

// ---------------------------------------------------------------------------
// Safeguard 2 — blocklist + password fields
// ---------------------------------------------------------------------------

test("BLOCKLISTED DOMAIN -> that item is dropped, nothing stored for it", () => {
  const r = mc.evaluateIngest(
    okEvalArgs({
      items: [
        baseItem({ domain: "secure.chase.com", text: "account balance" }),
        baseItem({ domain: "irs.gov", text: "tax refund status" }),
        baseItem({ domain: "google.com", text: "keep me" }),
      ],
    })
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].plaintext, "keep me");
  const reasons = r.dropped.map((d) => d.reason).sort();
  assert.deepEqual(reasons, ["blocklisted_domain", "blocklisted_domain"]);
});

test("blocklist: ALL items blocklisted -> 200 and zero rows", () => {
  const r = mc.evaluateIngest(
    okEvalArgs({ items: [baseItem({ domain: "paypal.com" })] })
  );
  assert.equal(r.rows.length, 0);
  assert.equal(r.status, 200);
});

test("password / masked field -> dropped", () => {
  const r = mc.evaluateIngest(
    okEvalArgs({ items: [baseItem({ is_password: true, text: "hunter2" })] })
  );
  assert.equal(r.rows.length, 0);
  assert.equal(r.dropped[0].reason, "password_field");
});

test("unknown/empty domain -> dropped (fail closed)", () => {
  const r = mc.evaluateIngest(
    okEvalArgs({ items: [baseItem({ domain: "" })] })
  );
  assert.equal(r.rows.length, 0);
  assert.equal(r.dropped[0].reason, "blocklisted_domain");
});

test("bad kind / empty text / oversized text -> dropped", () => {
  const r = mc.evaluateIngest(
    okEvalArgs({
      items: [
        baseItem({ kind: "keystroke" }),
        baseItem({ text: "   " }),
        baseItem({ text: "x".repeat(5000) }),
        baseItem({ text: "good one" }),
      ],
    })
  );
  assert.equal(r.rows.length, 1);
  assert.deepEqual(
    r.dropped.map((d) => d.reason).sort(),
    ["bad_kind", "empty_text", "text_too_long"]
  );
});

test("survivor rows carry expires_at = captured_at + retentionDays", () => {
  const r = mc.evaluateIngest(
    okEvalArgs({
      retentionDays: 45,
      items: [baseItem({ captured_at: "2026-09-03T09:00:00.000Z" })],
    })
  );
  assert.equal(r.rows[0].expires_at.toISOString(), "2026-10-18T09:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Safeguard 5 — access control
// ---------------------------------------------------------------------------

test("canViewContent: owner always, others only with a live matching grant", () => {
  const now = new Date("2026-09-03T12:00:00Z");
  assert.deepEqual(
    mc.canViewContent({ viewerRole: "owner", viewerUserId: 1, organizationId: 9, targetUserId: 5, grants: [], now }),
    { allowed: true, via: "owner" }
  );

  const liveGrant = {
    organization_id: 9,
    grantee_user_id: 2,
    target_user_id: 5,
    revoked_at: null,
    expires_at: "2026-09-04T00:00:00Z",
  };
  assert.equal(
    mc.canViewContent({ viewerRole: "admin", viewerUserId: 2, organizationId: 9, targetUserId: 5, grants: [liveGrant], now }).allowed,
    true
  );
  // wrong target
  assert.equal(
    mc.canViewContent({ viewerRole: "admin", viewerUserId: 2, organizationId: 9, targetUserId: 7, grants: [liveGrant], now }).allowed,
    false
  );
  // expired
  assert.equal(
    mc.canViewContent({ viewerRole: "admin", viewerUserId: 2, organizationId: 9, targetUserId: 5, grants: [{ ...liveGrant, expires_at: "2026-09-01T00:00:00Z" }], now }).allowed,
    false
  );
  // revoked
  assert.equal(
    mc.canViewContent({ viewerRole: "admin", viewerUserId: 2, organizationId: 9, targetUserId: 5, grants: [{ ...liveGrant, revoked_at: "2026-09-02T00:00:00Z" }], now }).allowed,
    false
  );
  // org-wide grant (target_user_id null) covers any employee
  assert.equal(
    mc.canViewContent({ viewerRole: "member", viewerUserId: 3, organizationId: 9, targetUserId: 99, grants: [{ ...liveGrant, grantee_user_id: 3, target_user_id: null }], now }).allowed,
    true
  );
  // no grant
  assert.equal(
    mc.canViewContent({ viewerRole: "member", viewerUserId: 4, organizationId: 9, targetUserId: 5, grants: [], now }).allowed,
    false
  );
});

test("ACCESS ENDPOINT writes the audit row BEFORE returning content", async () => {
  const calls = [];
  const fakeModels = {
    MonitoringContentGrant: {
      findAll: async () => {
        calls.push("grant.findAll");
        return [];
      },
    },
    MonitoringContentAccessLog: {
      create: async (row) => {
        calls.push("accesslog.create");
        return { ...row, update: async () => calls.push("accesslog.update") };
      },
    },
    MonitoringContentEvent: {
      findAll: async () => {
        calls.push("content.findAll");
        return [];
      },
    },
  };

  const res = await mc.readContent({
    organizationId: 9,
    viewer: { id: 1, role: "owner" },
    targetUserId: 5,
    from: "2026-09-01",
    to: "2026-09-03",
    ip: "127.0.0.1",
    models: fakeModels,
    deps: { gateApproved: true, now: new Date("2026-09-03T12:00:00Z") },
  });

  assert.equal(res.status, 200);
  // audit row created before any content row is read
  assert.ok(
    calls.indexOf("accesslog.create") < calls.indexOf("content.findAll"),
    `expected accesslog.create before content.findAll, got ${calls.join(" -> ")}`
  );
});

test("access denied -> 403 and NO content query at all", async () => {
  const calls = [];
  const res = await mc.readContent({
    organizationId: 9,
    viewer: { id: 2, role: "member" },
    targetUserId: 5,
    from: "2026-09-01",
    to: "2026-09-03",
    ip: null,
    models: {
      MonitoringContentGrant: { findAll: async () => [] },
      MonitoringContentAccessLog: { create: async () => calls.push("accesslog.create") },
      MonitoringContentEvent: { findAll: async () => calls.push("content.findAll") },
    },
    deps: { gateApproved: true },
  });
  assert.equal(res.status, 403);
  assert.deepEqual(calls, []); // nothing read, nothing logged
});

test("gate closed -> readContent 403 regardless of role", async () => {
  const res = await mc.readContent({
    organizationId: 9,
    viewer: { id: 1, role: "owner" },
    targetUserId: 5,
    from: "2026-09-01",
    to: "2026-09-03",
    models: {},
    deps: {}, // real gate = false
  });
  assert.equal(res.status, 403);
});

test("readContent decrypts on the fly and flags undecryptable rows", async () => {
  await withEnvAsync({ MONITORING_CONTENT_KEYS: KEYS, MONITORING_CONTENT_KEY_ACTIVE: "v1" }, async () => {
    const enc = cc.encrypt("explain useEffect");
    const rows = [
      {
        id: 1, app: "Chrome", kind: "prompt", domain: "chatgpt.com",
        ciphertext: enc.ciphertext, iv: enc.iv, auth_tag: enc.authTag, key_version: "v1",
        captured_at: new Date("2026-09-03T10:00:00Z"), expires_at: new Date("2026-10-03T10:00:00Z"),
      },
      {
        id: 2, app: "Chrome", kind: "search", domain: "google.com",
        ciphertext: Buffer.from("deadbeef", "hex"), iv: Buffer.alloc(12), auth_tag: Buffer.alloc(16),
        key_version: "gone", // WRONG KEY VERSION
        captured_at: new Date("2026-09-03T11:00:00Z"), expires_at: new Date("2026-10-03T11:00:00Z"),
      },
    ];
    const res = await mc.readContent({
      organizationId: 9,
      viewer: { id: 1, role: "owner" },
      targetUserId: 5,
      from: "2026-09-01",
      to: "2026-09-30",
      models: {
        MonitoringContentGrant: { findAll: async () => [] },
        MonitoringContentAccessLog: { create: async (r) => ({ ...r, update: async () => {} }) },
        MonitoringContentEvent: { findAll: async () => rows },
      },
      deps: { gateApproved: true },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.items[0].text, "explain useEffect");
    assert.equal(res.body.items[0].undecryptable, false);
    assert.equal(res.body.items[1].text, null);
    assert.equal(res.body.items[1].undecryptable, true); // wrong key_version -> decrypt fails, surfaced
  });
});

// ---------------------------------------------------------------------------
// Safeguard 4 — retention deletes ONLY expired
// ---------------------------------------------------------------------------

test("selectExpiredWhere targets only rows past expires_at", () => {
  const now = new Date("2026-09-03T12:00:00Z");
  const where = mc.selectExpiredWhere(now);
  const keys = Object.keys(where);
  assert.deepEqual(keys, ["expires_at"]); // nothing else in the WHERE
  const opSym = Object.getOwnPropertySymbols(where.expires_at)[0];
  assert.equal(String(opSym), "Symbol(lt)");
  assert.equal(where.expires_at[opSym], now);
});

test("sweepExpiredContent deletes with the expired-only WHERE and returns the count", async () => {
  let received = null;
  const deleted = await mc.sweepExpiredContent({
    now: new Date("2026-09-03T12:00:00Z"),
    destroy: async (where) => {
      received = where;
      return 7;
    },
  });
  assert.equal(deleted, 7);
  assert.deepEqual(Object.keys(received), ["expires_at"]);
  const opSym = Object.getOwnPropertySymbols(received.expires_at)[0];
  assert.equal(String(opSym), "Symbol(lt)");
});

// ---------------------------------------------------------------------------
// end-to-end (pure eval + real crypto) — a clean batch survives + encrypts
// ---------------------------------------------------------------------------

test("clean batch: survivors are the plaintext rows; crypto round-trips", () => {
  withEnv({ MONITORING_CONTENT_KEYS: KEYS, MONITORING_CONTENT_KEY_ACTIVE: "v1" }, () => {
    const r = mc.evaluateIngest(
      okEvalArgs({
        items: [
          baseItem({ text: "youtube lofi", domain: "youtube.com" }),
          baseItem({ kind: "prompt", text: "write a haiku", domain: "claude.ai" }),
        ],
      })
    );
    assert.equal(r.rows.length, 2);
    for (const row of r.rows) {
      const enc = cc.encrypt(row.plaintext);
      assert.equal(cc.decrypt(enc), row.plaintext);
      assert.equal(enc.keyVersion, "v1");
    }
  });
});
