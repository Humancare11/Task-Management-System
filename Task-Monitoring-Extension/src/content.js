// Content script — runs in every page. Turns real DOM events into the plain
// descriptors detector.classifyCommit() understands, and forwards a positive
// classification to the background service worker.
//
// It NEVER stores anything, NEVER reads a field other than the one that was
// just committed, and NEVER logs. It is a pass-through sensor.
//
// (detector.js is inlined at build time — see build.js — because MV3 content
// scripts can't use require().)

(function () {
    "use strict";

    // `detector` is provided by the concatenated detector.js above this IIFE
    // at build time. In the unbundled source it isn't defined; guard so this
    // file at least parses under Node for linting.
    if (typeof detector === "undefined") return; // eslint-disable-line no-undef
    const D = detector; // eslint-disable-line no-undef

    let enabled = false;
    let blocklist = [];

    // Background tells us whether capture is active and the blocklist to honor.
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.t === "config") {
            enabled = Boolean(msg.enabled);
            blocklist = Array.isArray(msg.blocklist) ? msg.blocklist : [];
        }
    });
    try {
        chrome.runtime.sendMessage({ t: "hello" });
    } catch {
        /* worker asleep — it will push config on wake */
    }

    function hostBlocked(host) {
        if (!host) return true;
        for (const patRaw of blocklist) {
            const pat = String(patRaw).trim().toLowerCase().replace(/\.+$/, "");
            if (!pat) continue;
            if (pat.startsWith("*.")) {
                const suf = pat.slice(2);
                if (host === suf || host.endsWith(`.${suf}`)) return true;
            } else if (host === pat || host.endsWith(`.${pat}`)) {
                return true;
            }
        }
        return false;
    }

    function describeField(el, form) {
        if (!el) return null;
        const tag = (el.tagName || "").toLowerCase();
        const inSearchRole = Boolean(
            el.closest && (el.closest('[role="search"]') || el.closest("search")),
        );
        let formHasSearchParam = false;
        const action = (form && (form.getAttribute("action") || form.action)) || "";
        if (action) {
            try {
                formHasSearchParam = Boolean(
                    D.urlHasSearchParam(new URL(action, location.href).href),
                );
            } catch {
                /* ignore */
            }
        }
        return {
            tag,
            type: (el.getAttribute && el.getAttribute("type")) || el.type || "",
            role: (el.getAttribute && el.getAttribute("role")) || "",
            name: (el.getAttribute && el.getAttribute("name")) || el.name || "",
            id: el.id || "",
            ariaLabel: (el.getAttribute && el.getAttribute("aria-label")) || "",
            placeholder: (el.getAttribute && el.getAttribute("placeholder")) || "",
            value: el.isContentEditable ? (el.innerText || el.textContent || "") : el.value || "",
            isContentEditable: Boolean(el.isContentEditable),
            inSearchRole,
            formHasSearchParam,
        };
    }

    function report(type, field, navUrl) {
        if (!enabled) return;
        let result;
        try {
            result = D.classifyCommit({ type, pageUrl: location.href, navUrl, field });
        } catch {
            return;
        }
        if (!result || !result.text) return;
        if (hostBlocked(result.host)) return;
        try {
            chrome.runtime.sendMessage({
                t: "capture",
                kind: result.kind,
                text: result.text,
                host: result.host,
                url: location.href,
            });
        } catch {
            /* worker asleep — a dropped message here is acceptable; the next
               one wakes it. */
        }
    }

    // 1. Form submit — capture phase so we see it before navigation.
    document.addEventListener(
        "submit",
        (e) => {
            const form = e.target;
            if (!form || form.tagName !== "FORM") return;
            const path = e.composedPath ? e.composedPath() : [];
            const input = path.find(
                (n) => n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.isContentEditable),
            ) || form.querySelector('input:not([type="hidden"]), textarea');
            report("submit", describeField(input, form), form.action);
        },
        true,
    );

    // 2. Enter key inside a text field with no form submit (SPA search, custom widgets).
    document.addEventListener(
        "keydown",
        (e) => {
            if (e.key !== "Enter" || e.isComposing || e.shiftKey) return;
            const path = e.composedPath ? e.composedPath() : [e.target];
            const el = path.find(
                (n) => n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.isContentEditable),
            );
            if (!el) return;
            const form = el.closest ? el.closest("form") : null;
            report("enter", describeField(el, form), null);
        },
        true,
    );

    // 3. The URL changed to one that carries a search parameter (SPA search
    //    results, autocomplete-suggestion clicks that navigate).
    let lastUrl = location.href;
    const onUrlMaybeChanged = () => {
        if (location.href === lastUrl) return;
        const from = lastUrl;
        lastUrl = location.href;
        if (D.urlHasSearchParam(location.href) && !D.urlHasSearchParam(from)) {
            report("url-search", null, location.href);
        }
    };
    for (const m of ["pushState", "replaceState"]) {
        const orig = history[m];
        history[m] = function (...args) {
            const r = orig.apply(this, args);
            queueMicrotask(onUrlMaybeChanged);
            return r;
        };
    }
    window.addEventListener("popstate", onUrlMaybeChanged);
})();
