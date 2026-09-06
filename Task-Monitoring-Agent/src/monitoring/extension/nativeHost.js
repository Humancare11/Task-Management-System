// Chrome native-messaging host. Chrome spawns this per connection (see the
// host manifest in Task-Monitoring-Extension/DEPLOYMENT.md). It does NOTHING
// except pump messages between Chrome (stdio, length-prefixed JSON) and the
// running agent (local pipe/socket). It holds no state and makes no decisions.
//
// Runs as plain Node (no Electron). If the agent is not running, the info file
// is absent or the pipe refuses — this process just exits and Chrome drops the
// port; capture is off anyway when the agent is down.

"use strict";

const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { encode, createDecoder } = require("./nativeMessaging");

const INFO_FILE = path.join(os.homedir(), ".humancare-monitoring", "ext-bridge.json");

function readInfo() {
    try {
        const j = JSON.parse(fs.readFileSync(INFO_FILE, "utf8"));
        if (j && j.pipe && j.token) return j;
    } catch {
        /* absent / unreadable */
    }
    return null;
}

function toChrome(obj) {
    try {
        process.stdout.write(encode(obj));
    } catch {
        process.exit(0);
    }
}

function main() {
    const info = readInfo();
    if (!info) {
        // Agent not running — nothing to bridge to.
        process.exit(0);
    }

    const sock = net.connect(info.pipe);
    const toAgent = (obj) => {
        try {
            sock.write(encode(obj));
        } catch {
            /* agent gone — handled by 'close' */
        }
    };

    const fromChrome = createDecoder();
    const fromAgent = createDecoder();

    sock.on("connect", () => {
        toAgent({ t: "auth", token: info.token });
        toAgent({ t: "hello", from: "native-host" });
    });

    sock.on("data", (chunk) => {
        let msgs;
        try {
            msgs = fromAgent.push(chunk);
        } catch {
            sock.destroy();
            return;
        }
        for (const m of msgs) toChrome(m); // e.g. { t:"config", enabled, blocklist }
    });

    sock.on("error", () => process.exit(0));
    sock.on("close", () => process.exit(0));

    process.stdin.on("data", (chunk) => {
        let msgs;
        try {
            msgs = fromChrome.push(chunk);
        } catch {
            process.exit(0);
        }
        for (const m of msgs) toAgent(m); // e.g. { t:"capture", ... } / { t:"hello" }
    });
    process.stdin.on("end", () => process.exit(0));
    process.stdin.on("error", () => process.exit(0));
}

main();
