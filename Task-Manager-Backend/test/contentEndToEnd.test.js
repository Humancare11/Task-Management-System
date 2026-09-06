"use strict";

// End-to-end proof: items shaped exactly as the agent's contentPipeline emits
// them (from the browser extension OR the UIA fallback) survive the full
// backend path — evaluateIngest gates -> contentCrypto.encrypt -> stored rows
// -> readContent-style decrypt -> what the dashboard shows.
//
// No live DB: the "table" is an array, but evaluateIngest, the real AES-GCM
// crypto, and the real decrypt-on-read are all exercised.

const test = require("node:test");
const assert = require("node:assert/strict");

const mc = require("../services/monitoringContent");
const cc = require("../utils/contentCrypto");

const KEYS = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");

function withKeys(fn) {
    const savedKeys = process.env.MONITORING_CONTENT_KEYS;
    const savedActive = process.env.MONITORING_CONTENT_KEY_ACTIVE;
    process.env.MONITORING_CONTENT_KEYS = JSON.stringify({ v1: KEYS });
    process.env.MONITORING_CONTENT_KEY_ACTIVE = "v1";
    cc._resetCache();
    try {
        return fn();
    } finally {
        if (savedKeys === undefined) delete process.env.MONITORING_CONTENT_KEYS;
        else process.env.MONITORING_CONTENT_KEYS = savedKeys;
        if (savedActive === undefined) delete process.env.MONITORING_CONTENT_KEY_ACTIVE;
        else process.env.MONITORING_CONTENT_KEY_ACTIVE = savedActive;
        cc._resetCache();
    }
}

// Items as contentPipeline.emitContent() would have queued them.
const AGENT_BATCH = [
    { client_event_id: "e1", app: "Google Chrome", kind: "search", text: "wireless noise cancelling headphones", domain: "amazon.com", captured_at: "2026-09-06T10:00:00.000Z" },
    { client_event_id: "e2", app: "Google Chrome", kind: "search", text: "lofi hip hop", domain: "youtube.com", captured_at: "2026-09-06T10:01:00.000Z" },
    { client_event_id: "e3", app: "Google Chrome", kind: "search", text: "how to renew a passport", domain: "reddit.com", captured_at: "2026-09-06T10:02:00.000Z" },
    { client_event_id: "e4", app: "Microsoft Edge", kind: "prompt", text: "explain the difference between a mutex and a semaphore with an example", domain: "chatgpt.com", captured_at: "2026-09-06T10:03:00.000Z" },
    { client_event_id: "e5", app: "Google Chrome", kind: "search", text: "account balance", domain: "wellsfargo.com", captured_at: "2026-09-06T10:04:00.000Z" }, // BANK -> must be dropped
];

test("end-to-end: a batch of captured searches/prompts is stored and reads back intact; the bank search is dropped", () => {
    withKeys(() => {
        // 1. INGEST — the exact gates the controller runs
        const evalResult = mc.evaluateIngest({
            gateApproved: true,
            keysConfigured: cc.isConfigured(),
            orgEnabled: true,
            hasConsent: true,
            items: AGENT_BATCH,
            blocklistPatterns: [], // hardcoded fallback (covers wellsfargo.com)
            retentionDays: 30,
            now: new Date("2026-09-06T10:05:00.000Z"),
        });

        assert.equal(evalResult.status, 201);
        // 4 kept, 1 dropped as a blocklisted bank domain
        assert.equal(evalResult.rows.length, 4);
        assert.deepEqual(
            evalResult.dropped.map((d) => [d.client_event_id, d.reason]),
            [["e5", "blocklisted_domain"]],
        );

        // 2. ENCRYPT + "STORE" — as ingestContent does before bulkCreate
        const stored = evalResult.rows.map((r) => {
            const enc = cc.encrypt(r.plaintext);
            return {
                app: r.app,
                kind: r.kind,
                domain: r.domain,
                ciphertext: enc.ciphertext,
                iv: enc.iv,
                auth_tag: enc.authTag,
                key_version: enc.keyVersion,
                captured_at: r.captured_at,
                expires_at: r.expires_at,
            };
        });

        // No readable copy is stored.
        for (const row of stored) {
            assert.ok(Buffer.isBuffer(row.ciphertext) || typeof row.ciphertext === "string");
            const asText = Buffer.isBuffer(row.ciphertext) ? row.ciphertext.toString("utf8") : String(row.ciphertext);
            assert.ok(!asText.includes("headphones"));
            assert.ok(!asText.includes("passport"));
        }

        // 3. READ — decrypt on the fly, newest first (dashboard order)
        const readBack = [...stored]
            .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))
            .map((row) => {
                let text;
                try {
                    text = cc.decrypt({
                        ciphertext: row.ciphertext,
                        iv: row.iv,
                        authTag: row.auth_tag,
                        keyVersion: row.key_version,
                    });
                } catch {
                    text = null;
                }
                return { kind: row.kind, domain: row.domain, text };
            });

        assert.deepEqual(readBack, [
            { kind: "prompt", domain: "chatgpt.com", text: "explain the difference between a mutex and a semaphore with an example" },
            { kind: "search", domain: "reddit.com", text: "how to renew a passport" },
            { kind: "search", domain: "youtube.com", text: "lofi hip hop" },
            { kind: "search", domain: "amazon.com", text: "wireless noise cancelling headphones" },
        ]);
    });
});

test("end-to-end: a version-mismatched consent rejects the WHOLE batch (nothing stored)", () => {
    withKeys(() => {
        const r = mc.evaluateIngest({
            gateApproved: true,
            keysConfigured: cc.isConfigured(),
            orgEnabled: true,
            hasConsent: false, // employee is on an older notice version
            items: AGENT_BATCH,
            blocklistPatterns: [],
            retentionDays: 30,
        });
        assert.equal(r.status, 403);
        assert.equal(r.code, "no_consent");
        assert.equal(r.rows.length, 0);
    });
});
