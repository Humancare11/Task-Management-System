"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("net");
const fs = require("fs");

const { encode, createDecoder } = require("../src/monitoring/extension/nativeMessaging");
const { evaluateCapture } = require("../src/monitoring/extension/bridgeIngest");
const bridge = require("../src/monitoring/extension/bridgeServer");
const cp = require("../src/monitoring/contentPipeline");

// --- native-messaging codec ------------------------------------------------

test("nativeMessaging: encode/decode round-trips, and reassembles split chunks", () => {
    const dec = createDecoder();
    const a = encode({ t: "capture", text: "hello world" });
    const b = encode({ t: "hello" });
    // feed byte-by-byte
    const all = Buffer.concat([a, b]);
    let out = [];
    for (const byte of all) out = out.concat(dec.push(Buffer.from([byte])));
    assert.equal(out.length, 2);
    assert.deepEqual(out[0], { t: "capture", text: "hello world" });
    assert.deepEqual(out[1], { t: "hello" });
});

test("nativeMessaging: an over-large declared length throws (caller closes)", () => {
    const dec = createDecoder();
    const header = Buffer.alloc(4);
    header.writeUInt32LE(5 * 1024 * 1024, 0);
    assert.throws(() => dec.push(header));
});

// --- ingest gating -------------------------------------------------------

test("evaluateCapture: a normal search on an arbitrary site is accepted", () => {
    const r = evaluateCapture(
        { kind: "search", text: "  noise cancelling headphones  ", host: "www.bestbuy.com", browser: "Google Chrome" },
        [],
    );
    assert.deepEqual(r, {
        ok: true,
        item: { app: "Google Chrome", kind: "search", text: "noise cancelling headphones", domain: "bestbuy.com" },
    });
});

test("evaluateCapture: falls back to the page URL for the host", () => {
    const r = evaluateCapture({ kind: "search", text: "quarterly figures", url: "https://intranet.corp.example.com/search?q=x" }, []);
    assert.equal(r.ok, true);
    assert.equal(r.item.domain, "intranet.corp.example.com");
});

test("evaluateCapture: blocklisted host is dropped", () => {
    const r = evaluateCapture({ kind: "search", text: "routing number", host: "secure.chase.com" }, ["chase.com", "*.chase.com"]);
    assert.deepEqual(r, { ok: false, reason: "blocklisted_domain" });
});

test("evaluateCapture: hardcoded blocklist still applies with an empty server list", () => {
    const r = evaluateCapture({ kind: "search", text: "balance", host: "www.wellsfargo.com" }, []);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "blocklisted_domain");
});

test("evaluateCapture: rejects bad kind / too short / no host", () => {
    assert.equal(evaluateCapture({ kind: "note", text: "x", host: "x.com" }, []).reason, "bad_kind");
    assert.equal(evaluateCapture({ kind: "search", text: "a", host: "x.com" }, []).reason, "too_short");
    assert.equal(evaluateCapture({ kind: "search", text: "hello", host: "not a host" }, []).reason, "no_host");
});

test("evaluateCapture: prompt allows a longer body than search", () => {
    const long = "y".repeat(3000);
    assert.equal(evaluateCapture({ kind: "search", text: long, host: "x.com" }, []).reason, "too_long");
    assert.equal(evaluateCapture({ kind: "prompt", text: long, host: "chatgpt.com" }, []).ok, true);
});

// --- server end-to-end -------------------------------------------------

test.afterEach(() => {
    bridge.stop();
    cp.initContentPipeline({ config: { contentFlushIntervalSeconds: 999 } });
});

function connectAuthed(token) {
    return new Promise((resolve, reject) => {
        const info = JSON.parse(fs.readFileSync(bridge.INFO_FILE, "utf8"));
        const sock = net.connect(info.pipe);
        const dec = createDecoder();
        const messages = [];
        sock.on("data", (c) => {
            for (const m of dec.push(c)) messages.push(m);
        });
        sock.on("error", reject);
        sock.on("connect", () => {
            sock.write(encode({ t: "auth", token: token === undefined ? info.token : token }));
            setTimeout(() => resolve({ sock, messages, realToken: info.token }), 60);
        });
    });
}

test("bridge server: an authed client, capture enabled -> the search reaches the content queue", async () => {
    cp.initContentPipeline({ config: { contentFlushIntervalSeconds: 999 } });
    cp.setActive(true);
    bridge.start();
    await new Promise((r) => setTimeout(r, 50));
    bridge.setState({ enabled: true, blocklist: [] });

    const { sock } = await connectAuthed();
    sock.write(encode({ t: "capture", kind: "search", text: "keyboard shortcuts", host: "docs.example.com", browser: "Google Chrome" }));
    await new Promise((r) => setTimeout(r, 80));

    assert.equal(cp._queueLength(), 1);
    sock.destroy();
});

test("bridge server: a wrong token is rejected, no capture accepted", async () => {
    cp.initContentPipeline({ config: { contentFlushIntervalSeconds: 999 } });
    cp.setActive(true);
    bridge.start();
    await new Promise((r) => setTimeout(r, 50));
    bridge.setState({ enabled: true, blocklist: [] });

    const { sock } = await connectAuthed("not-the-token");
    sock.write(encode({ t: "capture", kind: "search", text: "should not land", host: "x.com" }));
    await new Promise((r) => setTimeout(r, 80));

    assert.equal(cp._queueLength(), 0);
    sock.destroy();
});

test("bridge server: capture disabled -> messages are ignored even from an authed client", async () => {
    cp.initContentPipeline({ config: { contentFlushIntervalSeconds: 999 } });
    cp.setActive(true);
    bridge.start();
    await new Promise((r) => setTimeout(r, 50));
    bridge.setState({ enabled: false, blocklist: [] });

    const { sock } = await connectAuthed();
    sock.write(encode({ t: "capture", kind: "search", text: "nope", host: "x.com" }));
    await new Promise((r) => setTimeout(r, 80));

    assert.equal(cp._queueLength(), 0);
    sock.destroy();
});

test("bridge server: an authed client is pushed the config on connect and on change", async () => {
    bridge.start();
    await new Promise((r) => setTimeout(r, 50));
    bridge.setState({ enabled: false, blocklist: ["foo.com"] });

    const { sock, messages } = await connectAuthed();
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(messages.some((m) => m.t === "config" && m.enabled === false));

    bridge.setState({ enabled: true, blocklist: ["foo.com"] });
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(messages.some((m) => m.t === "config" && m.enabled === true));
    sock.destroy();
});
