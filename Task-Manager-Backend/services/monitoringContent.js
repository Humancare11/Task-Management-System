"use strict";

/**
 * §5b captured-content service — the five safeguards, as hard runtime gates.
 *
 * Every path here fails CLOSED: if the legal gate is not open, if keys are not
 * configured, if the org has not enabled capture, if the employee has no
 * matching consent row, or if the domain is blocklisted — nothing is stored and
 * nothing is returned.
 *
 * Split like monitoringDerivation.js:
 *   - pure functions (retentionDays, expiresAtFor, evaluateIngest, canViewContent,
 *     selectExpiredWhere) take plain data and are what the tests exercise;
 *   - the DB wrappers (ingestContent, readContent, sweepExpiredContent) wire the
 *     real models / crypto in and are thin.
 */

const { Op } = require("sequelize");
const {
  CONTENT_CAPTURE_LEGALLY_APPROVED,
  CONTENT_CONSENT_DOCUMENT_VERSION,
} = require("../config/contentCaptureGate");
const contentCrypto = require("../utils/contentCrypto");
const { matchesBlocklist } = require("../utils/contentBlocklist");

const RETENTION_MIN_DAYS = 30;
const RETENTION_MAX_DAYS = 90;
const RETENTION_DEFAULT_DAYS = 30;

const KIND_VALUES = new Set(["search", "prompt"]);
const MAX_TEXT_LEN = 2000;
const MAX_ITEMS_PER_BATCH = 200;

// ---------------------------------------------------------------------------
// pure helpers
// ---------------------------------------------------------------------------

/** Clamp an org's configured retention to [30, 90]; default 30. */
function retentionDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return RETENTION_DEFAULT_DAYS;
  return Math.min(RETENTION_MAX_DAYS, Math.max(RETENTION_MIN_DAYS, Math.round(n)));
}

/** expires_at = captured_at + retentionDays (whole days). */
function expiresAtFor(capturedAt, days) {
  const base = capturedAt instanceof Date ? capturedAt.getTime() : new Date(capturedAt).getTime();
  return new Date(base + days * 24 * 60 * 60 * 1000);
}

/**
 * Decide what a content-ingest batch produces. NO DB, NO crypto — returns the
 * plaintext rows that survived every gate; the caller encrypts + inserts.
 *
 * @param {object} p
 * @param {boolean} p.gateApproved      CONTENT_CAPTURE_LEGALLY_APPROVED
 * @param {boolean} p.keysConfigured    contentCrypto.isConfigured()
 * @param {boolean} p.orgEnabled        org.content_capture_enabled
 * @param {boolean} p.hasConsent        a monitoring_consents row exists for
 *                                      (user, current document_version)
 * @param {Array}   p.items             [{ client_event_id, app, kind, text, domain, is_password?, captured_at }]
 * @param {string[]} p.blocklistPatterns
 * @param {number}  p.retentionDays
 * @param {Date}    [p.now]
 * @returns {{ status:number, code?:string, message?:string,
 *             rows:Array, dropped:Array<{client_event_id:string, reason:string}> }}
 */
function evaluateIngest(p) {
  const now = p.now || new Date();

  // Safeguard 0 — the hard legal gate. 501, before anything else.
  if (!p.gateApproved) {
    return { status: 501, code: "not_approved", message: "Content capture is not enabled.", rows: [], dropped: [] };
  }
  // Safeguard 3 — encryption must be available or we never accept plaintext.
  if (!p.keysConfigured) {
    return { status: 503, code: "no_keys", message: "Content encryption is not configured.", rows: [], dropped: [] };
  }
  // Safeguard 1 (org) — the organization must have opted in.
  if (!p.orgEnabled) {
    return { status: 403, code: "org_disabled", message: "Content capture is not enabled for this organization.", rows: [], dropped: [] };
  }
  // Safeguard 1 (consent) — reject the whole batch with no matching consent row.
  if (!p.hasConsent) {
    return { status: 403, code: "no_consent", message: "No matching consent on file for this employee.", rows: [], dropped: [] };
  }

  const items = Array.isArray(p.items) ? p.items : [];
  if (items.length === 0) {
    return { status: 400, code: "empty", message: "items must be a non-empty array.", rows: [], dropped: [] };
  }
  if (items.length > MAX_ITEMS_PER_BATCH) {
    return { status: 400, code: "too_large", message: `Too many items (max ${MAX_ITEMS_PER_BATCH}).`, rows: [], dropped: [] };
  }

  const rows = [];
  const dropped = [];
  const days = retentionDays(p.retentionDays);
  const seen = new Set();

  for (let i = 0; i < items.length; i += 1) {
    const it = items[i] || {};
    const id = typeof it.client_event_id === "string" ? it.client_event_id.trim() : "";
    if (!id) {
      dropped.push({ client_event_id: `#${i + 1}`, reason: "missing_client_event_id" });
      continue;
    }
    if (seen.has(id)) continue; // in-batch dupe
    seen.add(id);

    // Safeguard 2 — never store a masked / password field.
    if (it.is_password === true) {
      dropped.push({ client_event_id: id, reason: "password_field" });
      continue;
    }
    if (!KIND_VALUES.has(it.kind)) {
      dropped.push({ client_event_id: id, reason: "bad_kind" });
      continue;
    }
    const text = typeof it.text === "string" ? it.text.trim() : "";
    if (!text) {
      dropped.push({ client_event_id: id, reason: "empty_text" });
      continue;
    }
    if (text.length > MAX_TEXT_LEN) {
      dropped.push({ client_event_id: id, reason: "text_too_long" });
      continue;
    }
    const app = typeof it.app === "string" ? it.app.trim().slice(0, 100) : "";
    if (!app) {
      dropped.push({ client_event_id: id, reason: "missing_app" });
      continue;
    }
    const capturedAt = it.captured_at ? new Date(it.captured_at) : now;
    if (Number.isNaN(capturedAt.getTime())) {
      dropped.push({ client_event_id: id, reason: "bad_captured_at" });
      continue;
    }

    // Safeguard 2 — blocklisted domain: nothing stored.
    const domain = typeof it.domain === "string" ? it.domain.trim().toLowerCase().slice(0, 255) : "";
    if (matchesBlocklist(domain, p.blocklistPatterns)) {
      dropped.push({ client_event_id: id, reason: "blocklisted_domain" });
      continue;
    }

    rows.push({
      client_event_id: id,
      app,
      kind: it.kind,
      domain: domain || null,
      plaintext: text,
      captured_at: capturedAt,
      expires_at: expiresAtFor(capturedAt, days),
    });
  }

  return { status: rows.length > 0 ? 201 : 200, code: "ok", rows, dropped };
}

/**
 * Safeguard 5 — who may read captured content.
 *   - the org OWNER may always read within their org;
 *   - anyone else needs an active (not revoked, not expired) grant that covers
 *     the target employee (target_user_id NULL = all employees).
 *
 * @param {object} p
 * @param {number} p.viewerUserId
 * @param {string} p.viewerRole
 * @param {number} p.organizationId
 * @param {number|null} p.targetUserId  the employee whose content is requested (null = any)
 * @param {Array} p.grants   this viewer's monitoring_content_grants rows in this org
 * @param {Date} [p.now]
 * @returns {{ allowed:boolean, via:"owner"|"grant"|null }}
 */
function canViewContent(p) {
  const now = p.now || new Date();
  if (p.viewerRole === "owner") return { allowed: true, via: "owner" };

  const grants = Array.isArray(p.grants) ? p.grants : [];
  for (const g of grants) {
    if (Number(g.organization_id) !== Number(p.organizationId)) continue;
    if (Number(g.grantee_user_id) !== Number(p.viewerUserId)) continue;
    if (g.revoked_at) continue;
    if (new Date(g.expires_at).getTime() <= now.getTime()) continue;
    if (g.target_user_id != null && p.targetUserId != null &&
        Number(g.target_user_id) !== Number(p.targetUserId)) {
      continue;
    }
    return { allowed: true, via: "grant" };
  }
  return { allowed: false, via: null };
}

/** Safeguard 4 — the WHERE that the retention sweep deletes. Only expired rows. */
function selectExpiredWhere(now = new Date()) {
  return { expires_at: { [Op.lt]: now } };
}

// ---------------------------------------------------------------------------
// DB wrappers (thin)
// ---------------------------------------------------------------------------

/**
 * Ingest a content batch for an already-authenticated agent.
 *
 * @param {object} args
 * @param {object} args.agent               the MonitoringAgent row (has organization_id, user_id, id)
 * @param {Array}  args.items
 * @param {object} args.models              { MonitoringOrgSetting, MonitoringConsent, MonitoringBlocklistDomain, MonitoringContentEvent }
 * @param {object} [args.deps]              test seam: { now, crypto, loadPatterns }
 * @returns {Promise<{status:number, body:object}>}
 */
async function ingestContent({ agent, items, models, deps = {} }) {
  const now = deps.now || new Date();
  const crypto = deps.crypto || contentCrypto;
  // Test seam only — the controller never passes this, so production always
  // reads the real compile-time constant.
  const gateApproved =
    deps.gateApproved !== undefined ? deps.gateApproved : CONTENT_CAPTURE_LEGALLY_APPROVED;

  // Fast 501 — never touch the DB while the gate is closed.
  if (!gateApproved) {
    return { status: 501, body: { message: "Content capture is not enabled." } };
  }

  const orgSettings = await models.MonitoringOrgSetting.findOne({
    where: { organization_id: agent.organization_id },
    raw: true,
  });

  const consent = await models.MonitoringConsent.findOne({
    where: {
      user_id: agent.user_id,
      document_version: CONTENT_CONSENT_DOCUMENT_VERSION,
    },
    raw: true,
  });

  const loadPatterns = deps.loadPatterns
    || (async () => {
      const { loadActivePatterns } = require("../utils/contentBlocklist");
      return loadActivePatterns(models.MonitoringBlocklistDomain);
    });
  const blocklistPatterns = await loadPatterns();

  const evalResult = evaluateIngest({
    gateApproved,
    keysConfigured: crypto.isConfigured(),
    orgEnabled: Boolean(orgSettings && orgSettings.content_capture_enabled),
    hasConsent: Boolean(consent),
    items,
    blocklistPatterns,
    retentionDays: orgSettings ? orgSettings.content_retention_days : RETENTION_DEFAULT_DAYS,
    now,
  });

  if (evalResult.status !== 201 && evalResult.status !== 200) {
    return {
      status: evalResult.status,
      body: { message: evalResult.message, code: evalResult.code },
    };
  }

  let insertedCount = 0;
  if (evalResult.rows.length > 0) {
    // De-dupe within the batch only (evaluateIngest already did). The content
    // table intentionally has no client_event_id column (minimal columns), so a
    // network retry could re-insert; the agent commits its content queue only
    // on a 2xx and retention bounds the blast radius. If exactly-once ever
    // matters here, add client_event_id + a unique index in a migration.
    const toCreate = evalResult.rows.map((r) => {
      const enc = crypto.encrypt(r.plaintext);
      return {
        organization_id: agent.organization_id,
        user_id: agent.user_id,
        agent_id: agent.id,
        app: r.app,
        kind: r.kind,
        domain: r.domain,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        auth_tag: enc.authTag,
        key_version: enc.keyVersion,
        source: "uia",
        captured_at: r.captured_at,
        expires_at: r.expires_at,
      };
    });
    const created = await models.MonitoringContentEvent.bulkCreate(toCreate);
    insertedCount = created.length;
  }

  return {
    status: 201,
    body: {
      message: "Content received.",
      accepted_count: evalResult.rows.length + evalResult.dropped.length,
      inserted_count: insertedCount,
      dropped: evalResult.dropped,
      accepted_event_ids: [
        ...evalResult.rows.map((r) => r.client_event_id),
        ...evalResult.dropped.map((d) => d.client_event_id),
      ],
    },
  };
}

/**
 * Read captured content for a date range. Writes the audit row BEFORE returning
 * any data (safeguard 5). Decrypts on the fly.
 *
 * @param {object} args
 * @param {number} args.organizationId
 * @param {object} args.viewer            { id, role }
 * @param {number} args.targetUserId
 * @param {string} args.from              YYYY-MM-DD
 * @param {string} args.to                YYYY-MM-DD
 * @param {string|null} args.ip
 * @param {object} args.models            { MonitoringContentGrant, MonitoringContentAccessLog, MonitoringContentEvent }
 * @param {object} [args.deps]            test seam: { now, crypto }
 * @returns {Promise<{status:number, body:object}>}
 */
async function readContent({ organizationId, viewer, targetUserId, from, to, ip, models, deps = {} }) {
  const now = deps.now || new Date();
  const crypto = deps.crypto || contentCrypto;
  const gateApproved =
    deps.gateApproved !== undefined ? deps.gateApproved : CONTENT_CAPTURE_LEGALLY_APPROVED;

  if (!gateApproved) {
    return { status: 403, body: { message: "Content capture is not enabled." } };
  }

  const grants =
    viewer.role === "owner"
      ? []
      : await models.MonitoringContentGrant.findAll({
          where: { organization_id: organizationId, grantee_user_id: viewer.id },
          raw: true,
        });

  const verdict = canViewContent({
    viewerUserId: viewer.id,
    viewerRole: viewer.role,
    organizationId,
    targetUserId,
    grants,
    now,
  });

  if (!verdict.allowed) {
    return { status: 403, body: { message: "You are not authorized to view captured content." } };
  }

  const fromDate = new Date(`${from}T00:00:00.000`);
  const toDate = new Date(`${to}T23:59:59.999`);

  // --- audit FIRST, always, before any content leaves the DB ---
  const logRow = await models.MonitoringContentAccessLog.create({
    organization_id: organizationId,
    viewer_user_id: viewer.id,
    target_user_id: targetUserId,
    date_from: from,
    date_to: to,
    row_count: 0, // patched below once known
    ip: ip || null,
    accessed_at: now,
  });

  const rows = await models.MonitoringContentEvent.findAll({
    where: {
      organization_id: organizationId,
      user_id: targetUserId,
      captured_at: { [Op.gte]: fromDate, [Op.lte]: toDate },
    },
    order: [["captured_at", "ASC"]],
    raw: true,
  });

  const items = [];
  for (const r of rows) {
    let text;
    try {
      text = crypto.decrypt({
        ciphertext: r.ciphertext,
        iv: r.iv,
        authTag: r.auth_tag,
        keyVersion: r.key_version,
      });
    } catch (err) {
      text = null; // undecryptable (key gone / tampered) — surface, don't crash
    }
    items.push({
      id: String(r.id),
      app: r.app,
      kind: r.kind,
      domain: r.domain,
      text,
      undecryptable: text === null,
      captured_at: r.captured_at,
      expires_at: r.expires_at,
    });
  }

  await logRow.update({ row_count: items.length }).catch(() => {});

  return {
    status: 200,
    body: { access_via: verdict.via, from, to, user_id: targetUserId, items },
  };
}

/**
 * Safeguard 4 — hard-delete every content row past expires_at.
 * @param {object} args
 * @param {Function} args.destroy   (where) => Promise<number>  (e.g. Model.destroy({ where }))
 * @param {Date} [args.now]
 * @returns {Promise<number>} rows deleted
 */
async function sweepExpiredContent({ destroy, now = new Date() }) {
  const where = selectExpiredWhere(now);
  const deleted = await destroy(where);
  return typeof deleted === "number" ? deleted : 0;
}

module.exports = {
  // constants
  RETENTION_MIN_DAYS,
  RETENTION_MAX_DAYS,
  RETENTION_DEFAULT_DAYS,
  CONTENT_CONSENT_DOCUMENT_VERSION,
  // pure
  retentionDays,
  expiresAtFor,
  evaluateIngest,
  canViewContent,
  selectExpiredWhere,
  // db wrappers
  ingestContent,
  readContent,
  sweepExpiredContent,
};
