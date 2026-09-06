// Search / AI-prompt detection — PURE logic, no DOM dependency.
//
// content.js turns real DOM events into the plain descriptors this module
// classifies. Keeping the decision here means it is unit-testable without a
// browser and stays identical to reason about across Chrome / Edge / Firefox.
//
// Scope, deliberately narrow (must match the consent notice): this only ever
// identifies a SEARCH query field or an AI-assistant PROMPT box. It never
// looks at any other input, never at page content, never at keystrokes outside
// the field it has identified.

"use strict";

// Known AI assistants — the committed value is captured as kind:"prompt".
// Page-level detection is reliable, so this list can be a bit broader than the
// agent's UIA heuristic without risk.
const PROMPT_HOSTS = new Set([
    "chatgpt.com",
    "chat.openai.com",
    "claude.ai",
    "gemini.google.com",
    "copilot.microsoft.com",
    "perplexity.ai",
]);

// Query-string parameters that mean "this navigation is a search".
const SEARCH_PARAMS = new Set([
    "q", "query", "search_query", "searchquery", "k", "p", "wd", "text",
    "search", "keyword", "keywords", "kw", "s",
]);

// name / id / aria-label / placeholder tokens that mark a search field.
function tokenLooksSearchy(token) {
    return (
        /^(q|kw|s)$/.test(token) ||
        /^(search|query|keyword|keywords)$/.test(token) ||
        token.startsWith("search") ||
        token.endsWith("search") ||
        token.startsWith("query")
    );
}

function normalizeHost(raw) {
    if (!raw || typeof raw !== "string") return null;
    let value = raw.trim();
    if (!value) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `http://${value}`;
    let host;
    try {
        const u = new URL(value);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        host = u.hostname;
    } catch {
        return null;
    }
    if (!host) return null;
    host = host.toLowerCase().replace(/\.+$/, "");
    if (host.startsWith("www.")) host = host.slice(4);
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) || host === "localhost") return null;
    return host;
}

function registrableDomain(host) {
    if (!host) return null;
    const labels = host.split(".");
    if (labels.length <= 2) return host;
    const twoLevel = new Set([
        "co.uk", "org.uk", "gov.uk", "ac.uk", "co.in", "co.jp", "com.au",
        "com.br", "co.nz", "co.za", "com.sg",
    ]);
    const lastTwo = labels.slice(-2).join(".");
    return twoLevel.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

/** Does this URL's query string carry a recognized search parameter + value? */
function urlHasSearchParam(url) {
    try {
        const u = new URL(url);
        for (const [key, val] of u.searchParams.entries()) {
            if (SEARCH_PARAMS.has(key.toLowerCase()) && val && val.trim()) {
                return val.trim();
            }
        }
    } catch {
        /* not a URL */
    }
    return null;
}

/**
 * @param {object} d
 * @param {"submit"|"enter"|"url-search"} d.type
 * @param {string} d.pageUrl              location.href of the page
 * @param {string} [d.navUrl]             the URL being navigated to (form action resolved / new SPA url)
 * @param {object} [d.field]              the committed input/textarea descriptor:
 *   { tag, type, role, name, id, ariaLabel, placeholder, value, isContentEditable, inSearchRole, inForm, formHasSearchParam }
 * @returns {{ kind:"search"|"prompt", text:string, host:string, registrableDomain:string } | null}
 */
function classifyCommit(d) {
    if (!d || typeof d !== "object") return null;

    const host = normalizeHost(d.pageUrl);
    if (!host) return null;
    const reg = registrableDomain(host);

    // --- AI prompt on a known assistant host --------------------------------
    if (PROMPT_HOSTS.has(host) || PROMPT_HOSTS.has(reg)) {
        const text = promptText(d.field);
        if (text) return { kind: "prompt", text, host, registrableDomain: reg };
        // fall through — the same host could still have a normal search field
    }

    // --- search, from the URL that is being navigated to --------------------
    const fromNav = d.type === "url-search" ? urlHasSearchParam(d.navUrl || d.pageUrl) : null;
    if (fromNav) {
        return { kind: "search", text: fromNav.slice(0, 2000), host, registrableDomain: reg };
    }

    // --- search, from a committed field -----------------------------------
    const f = d.field;
    if (!f) return null;
    const value = fieldValue(f);
    if (!value) return null;
    if (!looksLikeSearchField(f, d.navUrl || d.pageUrl)) return null;

    return { kind: "search", text: value.slice(0, 2000), host, registrableDomain: reg };
}

function fieldValue(f) {
    if (!f) return "";
    const raw = f.isContentEditable ? f.value : f.value;
    return typeof raw === "string" ? raw.trim() : "";
}

function promptText(f) {
    if (!f) return "";
    // The composer on an assistant site: a textarea or a contenteditable div.
    const tag = String(f.tag || "").toLowerCase();
    if (tag === "input" && f.type && f.type !== "text" && f.type !== "search") return "";
    const v = fieldValue(f);
    return v && v.length >= 1 ? v.slice(0, 8000) : "";
}

function looksLikeSearchField(f, navUrl) {
    const tag = String(f.tag || "").toLowerCase();
    const type = String(f.type || "").toLowerCase();

    // A password field is never a search field.
    if (type === "password") return false;
    // Only free-text inputs / textareas / contenteditables.
    if (tag === "input") {
        if (!["", "text", "search"].includes(type)) return false;
    } else if (tag !== "textarea" && !f.isContentEditable) {
        return false;
    }

    if (type === "search") return true;
    if (f.role === "searchbox" || f.role === "search") return true;
    if (f.inSearchRole) return true; // an ancestor <search> or role="search"

    const hay = [f.name, f.id, f.ariaLabel, f.placeholder]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const tokens = hay.split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.some(tokenLooksSearchy)) return true;

    // The form this field belongs to submits to a URL with a search param.
    if (f.formHasSearchParam) return true;
    if (navUrl && urlHasSearchParam(navUrl)) return true;

    return false;
}

module.exports = {
    PROMPT_HOSTS,
    SEARCH_PARAMS,
    normalizeHost,
    registrableDomain,
    urlHasSearchParam,
    tokenLooksSearchy,
    looksLikeSearchField,
    classifyCommit,
};
