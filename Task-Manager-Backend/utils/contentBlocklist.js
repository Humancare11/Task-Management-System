"use strict";

/**
 * §5b-1 content-capture domain blocklist.
 *
 * Content (search terms / AI prompts) is NEVER captured from a host that
 * matches the blocklist — enforced on BOTH the agent and the server. The DB
 * table monitoring_blocklist_domains is operator-tunable; HARDCODED_BLOCKLIST
 * here is the always-on fallback that applies even if that table is empty,
 * unreachable, or misconfigured.
 *
 * Pattern semantics (must match the migration header):
 *   "example.com"    -> example.com and any subdomain of it
 *   "*.example.com"  -> any subdomain of example.com, and example.com itself
 *   "*.gov"          -> any host whose last label is "gov" (TLD-level wildcard);
 *                       "*.gov.in" -> any host ending in ".gov.in"
 *
 * matchesBlocklist() is pure. loadActivePatterns() adds a short DB cache.
 */

// Always-on fallback. Conservative subset of the seed migration — enough that
// the feature is safe even with no DB list. Operators extend the DB table.
const HARDCODED_BLOCKLIST = [
  // banking
  "*.chase.com",
  "bankofamerica.com",
  "wellsfargo.com",
  "citi.com",
  "capitalone.com",
  "usbank.com",
  "hdfcbank.com",
  "icicibank.com",
  "sbi.co.in",
  "onlinesbi.sbi",
  "axisbank.com",
  "kotak.com",
  "barclays.co.uk",
  "hsbc.com",
  "lloydsbank.com",
  // payment
  "paypal.com",
  "stripe.com",
  "razorpay.com",
  "phonepe.com",
  "paytm.com",
  "pay.google.com",
  "payments.amazon.com",
  "wise.com",
  "venmo.com",
  // health
  "*.mychart.com",
  "healthcare.gov",
  "apollo247.com",
  "practo.com",
  "1mg.com",
  "zocdoc.com",
  // government
  "*.gov",
  "*.gov.in",
  "*.gov.uk",
  "*.gouv.fr",
  "uidai.gov.in",
  "incometax.gov.in",
  "irs.gov",
  "ssa.gov",
];

/** Lower-case, strip a leading "www.", drop any port / path / protocol. */
function normalizeHost(value) {
  if (!value || typeof value !== "string") return null;
  let host = value.trim().toLowerCase();
  if (!host) return null;
  // tolerate a full URL
  const scheme = host.indexOf("://");
  if (scheme !== -1) host = host.slice(scheme + 3);
  host = host.split("/")[0].split("?")[0].split("#")[0];
  host = host.split("@").pop(); // strip creds
  host = host.split(":")[0]; // strip port
  if (host.startsWith("www.")) host = host.slice(4);
  host = host.replace(/\.+$/, ""); // trailing dot
  return host || null;
}

function patternMatches(pattern, host) {
  if (!pattern || !host) return false;
  const p = String(pattern).trim().toLowerCase().replace(/\.+$/, "");
  if (!p) return false;

  if (p.startsWith("*.")) {
    const suffix = p.slice(2); // "example.com" or "gov" or "gov.in"
    return host === suffix || host.endsWith(`.${suffix}`);
  }

  // bare domain -> itself or any subdomain
  return host === p || host.endsWith(`.${p}`);
}

/**
 * @param {string} hostOrUrl   the domain/host (or full URL) the content came from
 * @param {string[]} patterns  blocklist patterns (DB ∪ hardcoded, or just pass
 *                              HARDCODED_BLOCKLIST)
 * @returns {boolean} true when capture from this host is FORBIDDEN
 */
function matchesBlocklist(hostOrUrl, patterns) {
  const host = normalizeHost(hostOrUrl);
  if (!host) {
    // No/unknown domain: be conservative for content — refuse. (Callers that
    // legitimately have no domain, e.g. a desktop app, pass an explicit
    // allowlisted host or their app id; see contentCapture allowlist.)
    return true;
  }
  const list =
    Array.isArray(patterns) && patterns.length ? patterns : HARDCODED_BLOCKLIST;
  for (const pattern of list) {
    if (patternMatches(pattern, host)) return true;
  }
  return false;
}

let _cache = { at: 0, patterns: null };
const CACHE_MS = 5 * 60 * 1000;

/**
 * Active patterns = DB rows (is_active) ∪ hardcoded fallback. Cached briefly.
 * Falls back to the hardcoded list alone if the DB read fails.
 * @param {import("sequelize").ModelStatic<any>} BlocklistModel
 */
async function loadActivePatterns(BlocklistModel, { force = false } = {}) {
  const now = Date.now();
  if (!force && _cache.patterns && now - _cache.at < CACHE_MS) {
    return _cache.patterns;
  }
  let dbPatterns = [];
  try {
    const rows = await BlocklistModel.findAll({
      where: { is_active: true },
      attributes: ["pattern"],
      raw: true,
    });
    dbPatterns = rows.map((r) => r.pattern).filter(Boolean);
  } catch (err) {
    // DB unreachable — the hardcoded fallback still protects us.
    console.error("contentBlocklist: DB read failed, using hardcoded fallback:", err.message);
  }
  const merged = [...new Set([...HARDCODED_BLOCKLIST, ...dbPatterns])];
  _cache = { at: now, patterns: merged };
  return merged;
}

function _resetCache() {
  _cache = { at: 0, patterns: null };
}

module.exports = {
  HARDCODED_BLOCKLIST,
  normalizeHost,
  patternMatches,
  matchesBlocklist,
  loadActivePatterns,
  _resetCache,
};
