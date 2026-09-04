// §5b in-app content capture — search queries from ANY website where a search /
// query field can be reliably detected, plus AI-assistant prompts on a small
// set of known assistants. Best-effort: it tolerates "nothing found", never
// throws, and rate-limits its warning so silent breakage (a target web app
// changed its markup) is still noticeable in the log.
//
// What it reads:
//   - the text of the FOCUSED edit control, via Windows UI Automation, ONLY
//     when that control is not a password field (UIA IsPassword) and:
//       * the control looks like a SEARCH / QUERY field (name / automationId /
//         ariaRole / localizedControlType), OR
//       * the foreground site is a known AI assistant (prompt box)
//     and the foreground tab's host is NOT on the blocklist and NOT a
//     private/incognito window.
//   - nothing else. No keystrokes, no page content, no other fields.
//
// The blocklist (banking / payment / healthcare / government) is enforced here
// and again on the server. It is NOT an allowlist — every other site is a
// capture candidate, gated only by search-field detection.
//
// When it emits:
//   - debounced: it tracks the current query text and emits the last non-empty
//     value when the field clears, the host changes, or the browser loses
//     focus — i.e. on submit / navigation, approximated without a keyboard hook.
//
// Everything here is INERT until contentPipeline.setActive(true), which the
// tracker only does when the heartbeat reports content_capture.active === true.

const logger = require("../utils/logger");
const { matchesBlocklist } = require("./contentBlocklistClient");

// Known AI assistants — captured as a "prompt" (unchanged from the original
// allowlist). Keyed by full host; ChatGPT / Claude are also matched at the
// registrable-domain level so any subdomain counts. Google is deliberately NOT
// in the registrable set (mail/docs/… must not be treated as prompts).
const PROMPT_HOSTS = new Set([
    "chatgpt.com",
    "chat.openai.com",
    "claude.ai",
    "gemini.google.com",
]);
const PROMPT_REGISTRABLE = new Set(["chatgpt.com", "claude.ai"]);

// Labels for the known assistants (nice-to-have; falls back to the host).
const PROMPT_LABELS = {
    "chatgpt.com": "ChatGPT",
    "chat.openai.com": "ChatGPT",
    "claude.ai": "Claude",
    "gemini.google.com": "Gemini",
};

const PRIVATE_MARKERS = [/incognito/i, /inprivate/i, /private browsing/i, /private window/i];

// Edit-like control types UIA reports for text inputs.
const SEARCH_CONTROL_TYPES = new Set([
    "ControlType.Edit",
    "ControlType.ComboBox",
]);

// A tokenised name / automationId / localizedControlType is a search field when
// it contains an exact "q" / "kw" token, or a token in / adjacent to the
// search / query / keyword family ("search", "searchbox", "search_query",
// "site-search", "queryInput", ...). "research", "First name", etc. do not match.
function tokenLooksSearchy(token) {
    return (
        /^(search|query|keyword|keywords)$/.test(token) ||
        token.startsWith("search") ||
        token.endsWith("search") ||
        token.startsWith("query")
    );
}

/** Is the focused control a known AI-assistant prompt box for this site? */
function classifyPromptSite(host, registrableDomain) {
    if (host && PROMPT_HOSTS.has(host)) {
        return { kind: "prompt", label: PROMPT_LABELS[host] || host };
    }
    if (registrableDomain && PROMPT_REGISTRABLE.has(registrableDomain)) {
        return {
            kind: "prompt",
            label: PROMPT_LABELS[registrableDomain] || registrableDomain,
        };
    }
    return null;
}

/**
 * Does the focused-control metadata identify a search / query field?
 * @param {{controlType?:string,name?:string,automationId?:string,
 *          ariaRole?:string,localizedControlType?:string}} meta
 */
function looksLikeSearchField(meta) {
    if (!meta || meta.isPassword) return false;
    const ct = meta.controlType || "";
    if (!SEARCH_CONTROL_TYPES.has(ct)) return false;

    const aria = String(meta.ariaRole || "").toLowerCase();
    if (aria === "searchbox" || aria === "search") return true;

    const hay = [meta.name, meta.automationId, meta.localizedControlType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const tokens = hay.split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.includes("q") || tokens.includes("kw")) return true;
    return tokens.some(tokenLooksSearchy);
}

/**
 * Decide whether the focused control on `host` is a capture target.
 *   - AI-assistant prompt box  -> { kind:"prompt", label }
 *   - detected search field    -> { kind:"search", label:<host> }
 *   - anything else            -> null
 * Blocklist / private-window checks are the caller's responsibility (done in
 * the tick loop, same as before).
 *
 * @param {string|null} host                full host, e.g. "gemini.google.com"
 * @param {string|null} registrableDomain   e.g. "google.com"
 * @param {object|null} fieldMeta           readFocusedField() result
 * @returns {{kind:"search"|"prompt", label:string}|null}
 */
function classifyTarget(host, registrableDomain, fieldMeta) {
    if (!host) return null;

    const prompt = classifyPromptSite(host, registrableDomain);
    if (prompt) return prompt;

    if (looksLikeSearchField(fieldMeta)) {
        return { kind: "search", label: host };
    }
    return null;
}

/** Heuristic private/incognito detection from the window title. */
function looksPrivate(windowTitle) {
    if (!windowTitle) return false;
    return PRIVATE_MARKERS.some((re) => re.test(windowTitle));
}

/**
 * Debounce reducer. Given the previous capture state and the current reading,
 * decide whether to emit and what the new pending value is.
 *
 * Emits the last non-empty `pending` when:
 *   - the field has cleared (was non-empty, now empty), OR
 *   - the target changed (host/app), OR
 *   - focus left the browser (currentText === null).
 *
 * @param {{ pending:string, targetKey:string }} prev
 * @param {{ text:string|null, targetKey:string|null }} cur
 * @returns {{ emit:string|null, state:{ pending:string, targetKey:string } }}
 */
function reduceQuery(prev, cur) {
    const prevPending = prev.pending || "";
    const prevKey = prev.targetKey || "";
    const curText = typeof cur.text === "string" ? cur.text.trim() : null;
    const curKey = cur.targetKey || "";

    // Target switched (or focus lost) — flush whatever we had.
    if (curKey !== prevKey) {
        return {
            emit: prevPending || null,
            state: { pending: curText || "", targetKey: curKey },
        };
    }

    // Same target: field cleared -> the user submitted / navigated away.
    if (prevPending && (curText === "" || curText === null)) {
        return { emit: prevPending, state: { pending: "", targetKey: curKey } };
    }

    // Same target, still typing / unchanged.
    return {
        emit: null,
        state: { pending: curText || prevPending, targetKey: curKey },
    };
}

const WARN_EVERY_MS = 5 * 60 * 1000;

/**
 * Start the capture loop.
 *
 * @param {object} p
 * @param {object} p.config
 * @param {Function} p.getForeground  async () => { applicationName, windowTitle, host, registrableDomain, isBrowser } | null
 * @param {Function} p.readQueryField async () => { text, isPassword, controlType, name, automationId, ariaRole, localizedControlType } | null
 * @param {Function} p.emit           (item:{app,kind,text,domain}) => void
 * @param {string[]|Function} [p.blocklistPatterns]  patterns, or a function returning them
 * @returns {{ stop:Function }}
 */
function startContentCapture(p) {
    const intervalMs = (p.config.contentPollIntervalSeconds || 4) * 1000;
    const resolveBlocklist =
        typeof p.blocklistPatterns === "function"
            ? p.blocklistPatterns
            : () => p.blocklistPatterns;
    let state = { pending: "", targetKey: "" };
    // Attribution for the LAST field we were capturing from — kept across state
    // resets so a flush triggered by leaving that field/site still records the
    // right app + host + kind.
    let last = { app: null, domain: null, kind: null };
    let running = false;
    let consecutiveMisses = 0;
    let lastWarnAt = 0;

    // Flush any pending query, attributing it to the last active field.
    function flushPending(cur) {
        const r = reduceQuery(state, cur);
        state = r.state;
        if (r.emit) flush(r.emit, last.app, last.domain, last.kind);
    }

    async function tick() {
        if (running) return;
        running = true;
        try {
            const fg = await p.getForeground();

            // Not a browser / no host / focus elsewhere -> flush pending.
            if (!fg || !fg.isBrowser || !fg.host) {
                flushPending({ text: null, targetKey: null });
                return;
            }

            if (
                looksPrivate(fg.windowTitle) ||
                matchesBlocklist(fg.host, resolveBlocklist())
            ) {
                flushPending({ text: null, targetKey: "" });
                return;
            }

            const field = await p.readQueryField();
            if (!field) {
                consecutiveMisses += 1;
                maybeWarn(fg.host);
                // Can't read — treat as "unchanged", don't lose pending.
                return;
            }
            consecutiveMisses = 0;

            if (field.isPassword) {
                // Never touch a password field. Flush any prior pending.
                flushPending({ text: null, targetKey: "" });
                return;
            }

            const target = classifyTarget(fg.host, fg.registrableDomain, field);
            if (!target) {
                // Focused control is not a search / prompt field — flush prior.
                flushPending({ text: null, targetKey: "" });
                return;
            }

            const key = `${fg.applicationName}|${fg.host}|${target.kind}`;
            const r = reduceQuery(state, { text: field.text, targetKey: key });
            state = r.state;
            if (r.emit) flush(r.emit, last.app, last.domain, last.kind);
            last = { app: fg.applicationName, domain: fg.host, kind: target.kind };
        } catch (err) {
            logger.warn(`Content capture tick failed: ${err.message}`);
        } finally {
            running = false;
        }
    }

    function flush(text, app, domain, kind) {
        const value = String(text || "").trim();
        if (value.length < 2 || value.length > 2000) return;
        try {
            p.emit({
                app: app || "Browser",
                kind: kind === "prompt" ? "prompt" : "search",
                text: value,
                domain: domain || null,
            });
        } catch (err) {
            logger.warn(`Content emit failed: ${err.message}`);
        }
    }

    function maybeWarn(host) {
        if (consecutiveMisses < 5) return;
        const now = Date.now();
        if (now - lastWarnAt < WARN_EVERY_MS) return;
        lastWarnAt = now;
        logger.warn(
            `Content capture: ${consecutiveMisses} consecutive UIA misses on ${host} — ` +
            `the focused element could not be read.`,
        );
    }

    tick();
    const timer = setInterval(tick, intervalMs);
    if (timer.unref) timer.unref();

    return {
        stop() {
            clearInterval(timer);
            // Flush a final pending value on a clean stop.
            if (state.pending) flush(state.pending, last.app, last.domain, last.kind);
        },
        // Test seam: run one poll synchronously (the loop is otherwise driven by
        // the interval). Not used in production.
        _tick: tick,
    };
}

module.exports = {
    PROMPT_HOSTS,
    PROMPT_REGISTRABLE,
    classifyPromptSite,
    looksLikeSearchField,
    classifyTarget,
    looksPrivate,
    reduceQuery,
    startContentCapture,
};
