// §5b in-app content capture — search terms / AI prompts, for a CURATED
// ALLOWLIST only. Best-effort: it tolerates "nothing found", never throws, and
// rate-limits its warning so silent breakage (a target web app changed its
// markup) is still noticeable in the log.
//
// What it reads:
//   - the text of the FOCUSED edit control, via Windows UI Automation, ONLY
//     when that control is not a password field (UIA IsPassword) and the
//     foreground tab's domain is on ALLOWLIST and NOT on the blocklist and NOT
//     a private/incognito window.
//   - nothing else. No keystrokes, no page content, no other fields.
//
// When it emits:
//   - debounced: it tracks the current query text and emits the last non-empty
//     value when the field clears, the domain changes, or the browser loses
//     focus — i.e. on submit / navigation, approximated without a keyboard hook.
//
// Everything here is INERT until contentPipeline.setActive(true), which the
// tracker only does when the heartbeat reports content_capture.active === true.

const logger = require("../utils/logger");
const { matchesBlocklist } = require("./contentBlocklistClient");

// domain (registrable) -> { kind, label }
const ALLOWLIST = {
    "google.com": { kind: "search", label: "Google Search" },
    "www.google.com": { kind: "search", label: "Google Search" },
    "youtube.com": { kind: "search", label: "YouTube" },
    "www.youtube.com": { kind: "search", label: "YouTube" },
    "chatgpt.com": { kind: "prompt", label: "ChatGPT" },
    "chat.openai.com": { kind: "prompt", label: "ChatGPT" },
    "claude.ai": { kind: "prompt", label: "Claude" },
    "gemini.google.com": { kind: "prompt", label: "Gemini" },
};

const PRIVATE_MARKERS = [/incognito/i, /inprivate/i, /private browsing/i, /private window/i];

/** Allowlist classification for a domain, or null when not a capture target. */
function classifyTarget(domain) {
    if (!domain) return null;
    const d = String(domain).toLowerCase().replace(/^www\./, "");
    return (
        ALLOWLIST[d] ||
        ALLOWLIST[`www.${d}`] ||
        (d === "google.com" ? ALLOWLIST["google.com"] : null)
    );
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
 *   - the target changed (domain/app), OR
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
 * @param {Function} p.getForeground  async () => { applicationName, windowTitle, domain, isBrowser } | null
 * @param {Function} p.readQueryField async () => { text:string, isPassword:boolean } | null
 * @param {Function} p.emit           (item:{app,kind,text,domain}) => void
 * @param {string[]} [p.blocklistPatterns]
 * @returns {{ stop:Function }}
 */
function startContentCapture(p) {
    const intervalMs = (p.config.contentPollIntervalSeconds || 4) * 1000;
    let state = { pending: "", targetKey: "" };
    let running = false;
    let consecutiveMisses = 0;
    let lastWarnAt = 0;

    async function tick() {
        if (running) return;
        running = true;
        try {
            const fg = await p.getForeground();

            // Not a browser / no domain / focus elsewhere -> flush pending.
            if (!fg || !fg.isBrowser || !fg.domain) {
                const r = reduceQuery(state, { text: null, targetKey: null });
                state = r.state;
                if (r.emit) flush(r.emit, null, null);
                return;
            }

            const target = classifyTarget(fg.domain);
            const key = target ? `${fg.applicationName}|${fg.domain}` : "";

            if (!target || looksPrivate(fg.windowTitle) ||
                matchesBlocklist(fg.domain, p.blocklistPatterns)) {
                const r = reduceQuery(state, { text: null, targetKey: "" });
                state = r.state;
                if (r.emit) flush(r.emit, state._lastApp, state._lastDomain);
                return;
            }

            const field = await p.readQueryField();
            if (!field) {
                consecutiveMisses += 1;
                maybeWarn(fg.domain);
                // Can't read — treat as "unchanged", don't lose pending.
                return;
            }
            consecutiveMisses = 0;

            if (field.isPassword) {
                // Never touch a password field. Flush any prior pending.
                const r = reduceQuery(state, { text: null, targetKey: key });
                state = r.state;
                return;
            }

            const r = reduceQuery(state, { text: field.text, targetKey: key });
            state = r.state;
            state._lastApp = fg.applicationName;
            state._lastDomain = fg.domain;
            if (r.emit) flush(r.emit, fg.applicationName, fg.domain, target.kind);
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
                kind: kind || "search",
                text: value,
                domain: domain || null,
            });
        } catch (err) {
            logger.warn(`Content emit failed: ${err.message}`);
        }
    }

    function maybeWarn(domain) {
        if (consecutiveMisses < 5) return;
        const now = Date.now();
        if (now - lastWarnAt < WARN_EVERY_MS) return;
        lastWarnAt = now;
        logger.warn(
            `Content capture: ${consecutiveMisses} consecutive UIA misses on ${domain} — ` +
            `the selector may have broken (target site changed).`,
        );
    }

    tick();
    const timer = setInterval(tick, intervalMs);
    if (timer.unref) timer.unref();

    return {
        stop() {
            clearInterval(timer);
            // Flush a final pending value on a clean stop.
            if (state.pending) flush(state.pending, state._lastApp, state._lastDomain);
        },
    };
}

module.exports = {
    ALLOWLIST,
    classifyTarget,
    looksPrivate,
    reduceQuery,
    startContentCapture,
};
