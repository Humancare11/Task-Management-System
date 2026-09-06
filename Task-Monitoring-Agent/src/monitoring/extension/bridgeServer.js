// Agent-side endpoint for the browser extension.
//
//   Chrome  --native messaging-->  nativeHost.js  --local pipe/socket-->  THIS
//
// nativeHost.js is a tiny process Chrome spawns; it just pumps bytes between
// Chrome's stdio and this server. This module owns the trust decisions:
//   - a shared token (written to a 0600 file only the same OS user can read)
//     must be presented before any capture is accepted,
//   - every capture is run through evaluateCapture() — same gates as the UIA
//     path (kind, length, blocklist) — then handed to contentPipeline.emitContent
//     which applies the dedupe and the active-gate.
//
// The server holds NO captured text. It is inert until setState({enabled:true})
// is called by main.js's applyContentSignal (i.e. only when the heartbeat says
// capture is active).

"use strict";

const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const crypto = require("crypto");
const logger = require("../../utils/logger");
const { createDecoder, encode } = require("./nativeMessaging");
const { evaluateCapture } = require("./bridgeIngest");
const contentPipeline = require("../contentPipeline");

const INFO_DIR = path.join(os.homedir(), ".humancare-monitoring");
const INFO_FILE = path.join(INFO_DIR, "ext-bridge.json");

function defaultPipePath() {
    if (process.platform === "win32") {
        return "\\\\.\\pipe\\co.humancareconnect.monitoring";
    }
    return path.join(os.tmpdir(), "humancare-monitoring-ext.sock");
}

let server = null;
let token = null;
let pipePath = null;
let state = { enabled: false, blocklist: [] };
const clients = new Set(); // authed sockets

function writeInfoFile() {
    try {
        fs.mkdirSync(INFO_DIR, { recursive: true });
        fs.writeFileSync(
            INFO_FILE,
            JSON.stringify({ pipe: pipePath, token }, null, 2),
            { mode: 0o600 },
        );
    } catch (err) {
        logger.warn(`Extension bridge: could not write info file: ${err.message}`);
    }
}

function removeInfoFile() {
    try {
        fs.unlinkSync(INFO_FILE);
    } catch {
        /* already gone */
    }
}

function sendConfig(sock) {
    try {
        sock.write(encode({ t: "config", enabled: state.enabled, blocklist: state.blocklist }));
    } catch {
        /* socket gone */
    }
}

function handleConnection(sock) {
    const decoder = createDecoder();
    let authed = false;

    sock.on("data", (chunk) => {
        let msgs;
        try {
            msgs = decoder.push(chunk);
        } catch (err) {
            logger.warn(`Extension bridge: framing error (${err.message}) — closing.`);
            sock.destroy();
            return;
        }
        for (const msg of msgs) {
            if (!authed) {
                if (msg && msg.t === "auth" && token && msg.token === token) {
                    authed = true;
                    clients.add(sock);
                    sendConfig(sock);
                } else {
                    sock.destroy();
                    return;
                }
                continue;
            }
            if (!msg || typeof msg !== "object") continue;
            if (msg.t === "hello") {
                sendConfig(sock);
            } else if (msg.t === "capture") {
                if (!state.enabled) continue;
                const r = evaluateCapture(msg, state.blocklist);
                if (r.ok) {
                    contentPipeline.emitContent(r.item);
                }
                // dropped: bridgeIngest reason is intentionally not logged with
                // the text; a periodic count could be added later.
            }
        }
    });

    sock.on("error", () => sock.destroy());
    sock.on("close", () => clients.delete(sock));
}

function start() {
    if (server) return;
    token = crypto.randomBytes(24).toString("hex");
    pipePath = defaultPipePath();

    // On non-Windows a stale socket file blocks listen().
    if (process.platform !== "win32") {
        try {
            fs.unlinkSync(pipePath);
        } catch {
            /* fine */
        }
    }

    server = net.createServer(handleConnection);
    server.on("error", (err) => {
        logger.warn(`Extension bridge server error: ${err.message}`);
    });
    server.listen(pipePath, () => {
        writeInfoFile();
        logger.info(`Extension bridge listening (${pipePath}).`);
    });
}

function stop() {
    for (const sock of clients) {
        try {
            sock.destroy();
        } catch {
            /* ignore */
        }
    }
    clients.clear();
    if (server) {
        try {
            server.close();
        } catch {
            /* ignore */
        }
        server = null;
    }
    removeInfoFile();
    token = null;
}

/**
 * Push the current capture state to every connected extension.
 * @param {{ enabled:boolean, blocklist?:string[] }} next
 */
function setState(next) {
    if (!next) return;
    state = {
        enabled: Boolean(next.enabled),
        blocklist: Array.isArray(next.blocklist) ? next.blocklist : state.blocklist,
    };
    for (const sock of clients) sendConfig(sock);
}

// test seam
function _internals() {
    return { INFO_FILE, get token() { return token; }, get clientCount() { return clients.size; }, get state() { return state; } };
}

module.exports = { start, stop, setState, INFO_FILE, _internals };
