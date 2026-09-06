// Turn one { t:"capture", kind, text, host, url, browser } message from the
// browser extension into a content-pipeline emit — or a drop, with a reason.
// PURE: no I/O, no pipeline reference. The server module wires it in.
//
// Every gate the UIA path already applies is applied here too: it must be a
// search or prompt, non-empty, within length bounds, and NOT on a blocklisted
// host. Consent / legal gate / encryption / audit are all downstream and
// unchanged — this only decides "queue it or not".

"use strict";

// STRICT host validation (requires a real label.tld web host) — the lenient
// normalizeHost in contentBlocklistClient would let a garbage non-URL string
// through as "not blocklisted".
const { normalizeHost } = require("../domainDetector");
const { matchesBlocklist } = require("../contentBlocklistClient");

const MIN_LEN = 2;
const MAX_SEARCH_LEN = 2000;
const MAX_PROMPT_LEN = 8000;

/**
 * @param {object} msg           the extension message
 * @param {string[]} blocklist   active blocklist patterns (may be empty -> hardcoded fallback used by matchesBlocklist)
 * @returns {{ ok:true, item:{app,kind,text,domain} } | { ok:false, reason:string }}
 */
function evaluateCapture(msg, blocklist) {
    if (!msg || typeof msg !== "object") return { ok: false, reason: "bad_message" };

    const kind = msg.kind === "prompt" ? "prompt" : msg.kind === "search" ? "search" : null;
    if (!kind) return { ok: false, reason: "bad_kind" };

    const text = typeof msg.text === "string" ? msg.text.trim() : "";
    if (text.length < MIN_LEN) return { ok: false, reason: "too_short" };
    const cap = kind === "prompt" ? MAX_PROMPT_LEN : MAX_SEARCH_LEN;
    if (text.length > cap) return { ok: false, reason: "too_long" };

    // Prefer the explicit host; fall back to parsing the page URL.
    const host = normalizeHost(msg.host) || normalizeHost(msg.url);
    if (!host) return { ok: false, reason: "no_host" };

    if (matchesBlocklist(host, Array.isArray(blocklist) ? blocklist : undefined)) {
        return { ok: false, reason: "blocklisted_domain" };
    }

    const app =
        typeof msg.browser === "string" && msg.browser.trim()
            ? msg.browser.trim().slice(0, 100)
            : "Browser";

    return { ok: true, item: { app, kind, text: text.slice(0, cap), domain: host } };
}

module.exports = { evaluateCapture, MIN_LEN, MAX_SEARCH_LEN, MAX_PROMPT_LEN };
