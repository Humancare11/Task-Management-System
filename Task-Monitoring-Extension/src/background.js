// Background service worker.
//
//   content scripts  --(runtime message)-->  here  --(native messaging)-->  agent
//   agent            --(native messaging)-->  here  --(runtime message)-->  content scripts
//
// The agent is the source of truth for whether capture is active and for the
// blocklist. This worker holds no captured text — every "capture" message is
// forwarded to the agent's native host and dropped. Incognito windows are
// filtered here (never forwarded).

"use strict";

const NATIVE_HOST = "co.humancareconnect.monitoring";

let port = null;
let config = { enabled: false, blocklist: [] };
let reconnectTimer = null;

function connect() {
    if (port) return;
    try {
        port = chrome.runtime.connectNative(NATIVE_HOST);
    } catch (e) {
        console.warn("[monitoring] connectNative threw:", e && e.message);
        scheduleReconnect();
        return;
    }
    port.onMessage.addListener((msg) => {
        if (msg && msg.t === "config") {
            config = {
                enabled: Boolean(msg.enabled),
                blocklist: Array.isArray(msg.blocklist) ? msg.blocklist : [],
            };
            console.log("[monitoring] config from agent — enabled:", config.enabled, "blocklist:", config.blocklist.length);
            broadcastConfig();
        }
    });
    port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError;
        console.warn("[monitoring] native port disconnected:", err && err.message);
        port = null;
        // If the agent turns capture off by dying, stop capturing.
        config = { enabled: false, blocklist: config.blocklist };
        broadcastConfig();
        scheduleReconnect();
    });
    console.log("[monitoring] native port connected to", NATIVE_HOST);
    // Announce ourselves so the agent pushes current config.
    try {
        port.postMessage({ t: "hello", v: chrome.runtime.getManifest().version });
    } catch {
        /* will retry on reconnect */
    }
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, 15000);
}

async function broadcastConfig() {
    let tabs = [];
    try {
        tabs = await chrome.tabs.query({});
    } catch {
        return;
    }
    for (const tab of tabs) {
        if (!tab.id) continue;
        chrome.tabs
            .sendMessage(tab.id, { t: "config", enabled: config.enabled, blocklist: config.blocklist })
            .catch(() => {});
    }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!msg) return;

    if (msg.t === "hello") {
        // A content script woke / loaded — send it current config.
        if (sender.tab && sender.tab.id) {
            chrome.tabs
                .sendMessage(sender.tab.id, {
                    t: "config",
                    enabled: config.enabled,
                    blocklist: config.blocklist,
                })
                .catch(() => {});
        }
        return;
    }

    if (msg.t === "capture") {
        if (!config.enabled) return;
        // Never forward anything from an incognito / private window.
        if (sender.tab && sender.tab.incognito) return;
        if (!port) {
            connect();
            return; // this one is dropped; the pipe was down
        }
        try {
            port.postMessage({
                t: "capture",
                kind: msg.kind === "prompt" ? "prompt" : "search",
                text: String(msg.text || "").slice(0, 8000),
                host: msg.host || null,
                url: msg.url || null,
                browser: guessBrowser(),
                ts: Date.now(),
            });
            console.log("[monitoring] forwarded", msg.kind, "on", msg.host);
        } catch {
            port = null;
            scheduleReconnect();
        }
    }
});

function guessBrowser() {
    const ua = (navigator.userAgent || "").toLowerCase();
    if (ua.includes("edg/")) return "Microsoft Edge";
    if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
    if (ua.includes("brave")) return "Brave";
    if (ua.includes("vivaldi")) return "Vivaldi";
    if (ua.includes("firefox")) return "Firefox";
    if (ua.includes("chrome")) return "Google Chrome";
    return "Browser";
}

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
