// §5b-1 content blocklist — AGENT side.
//
// The agent enforces the always-on HARDCODED fallback (kept byte-for-byte in
// sync with the server's utils/contentBlocklist.js HARDCODED_BLOCKLIST). The
// SERVER is authoritative and additionally enforces the operator-tunable
// monitoring_blocklist_domains table on ingest, dropping anything the agent's
// fallback list missed. So capture from a blocklisted host is blocked twice.
//
// Pure. No dependencies.

const HARDCODED_BLOCKLIST = [
    // banking
    "*.chase.com", "bankofamerica.com", "wellsfargo.com", "citi.com",
    "capitalone.com", "usbank.com", "hdfcbank.com", "icicibank.com",
    "sbi.co.in", "onlinesbi.sbi", "axisbank.com", "kotak.com",
    "barclays.co.uk", "hsbc.com", "lloydsbank.com",
    // payment
    "paypal.com", "stripe.com", "razorpay.com", "phonepe.com", "paytm.com",
    "pay.google.com", "payments.amazon.com", "wise.com", "venmo.com",
    // health
    "*.mychart.com", "healthcare.gov", "apollo247.com", "practo.com",
    "1mg.com", "zocdoc.com",
    // government
    "*.gov", "*.gov.in", "*.gov.uk", "*.gouv.fr",
    "uidai.gov.in", "incometax.gov.in", "irs.gov", "ssa.gov",
];

function normalizeHost(value) {
    if (!value || typeof value !== "string") return null;
    let host = value.trim().toLowerCase();
    if (!host) return null;
    const scheme = host.indexOf("://");
    if (scheme !== -1) host = host.slice(scheme + 3);
    host = host.split("/")[0].split("?")[0].split("#")[0];
    host = host.split("@").pop();
    host = host.split(":")[0];
    if (host.startsWith("www.")) host = host.slice(4);
    host = host.replace(/\.+$/, "");
    return host || null;
}

function patternMatches(pattern, host) {
    if (!pattern || !host) return false;
    const p = String(pattern).trim().toLowerCase().replace(/\.+$/, "");
    if (!p) return false;
    if (p.startsWith("*.")) {
        const suffix = p.slice(2);
        return host === suffix || host.endsWith(`.${suffix}`);
    }
    return host === p || host.endsWith(`.${p}`);
}

/**
 * @param {string} hostOrUrl
 * @param {string[]} [patterns]  extra patterns; defaults to the hardcoded list
 * @returns {boolean} true when capture from this host is FORBIDDEN
 */
function matchesBlocklist(hostOrUrl, patterns) {
    const host = normalizeHost(hostOrUrl);
    if (!host) return true; // fail closed
    const list = Array.isArray(patterns) && patterns.length ? patterns : HARDCODED_BLOCKLIST;
    return list.some((pat) => patternMatches(pat, host));
}

module.exports = { HARDCODED_BLOCKLIST, normalizeHost, patternMatches, matchesBlocklist };
