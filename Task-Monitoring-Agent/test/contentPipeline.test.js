"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// contentPipeline is a singleton module; reset it between tests via init.
const cp = require("../src/monitoring/contentPipeline");

function reset() {
  cp.initContentPipeline({ config: { contentFlushIntervalSeconds: 30 } });
}

test("emitContent is a NO-OP until setActive(true)", () => {
  reset();
  assert.equal(cp.isActive(), false);
  cp.emitContent({ app: "Chrome", kind: "search", text: "hello world" });
  assert.equal(cp._queueLength(), 0);

  cp.setActive(true);
  cp.emitContent({ app: "Chrome", kind: "search", text: "hello world" });
  assert.equal(cp._queueLength(), 1);
});

test("setActive(false) drops the queued plaintext", () => {
  reset();
  cp.setActive(true);
  cp.emitContent({ app: "Chrome", kind: "search", text: "a" });
  cp.emitContent({ app: "Chrome", kind: "prompt", text: "b" });
  assert.equal(cp._queueLength(), 2);
  cp.setActive(false);
  assert.equal(cp._queueLength(), 0);
});

test("emitContent ignores empty text and clamps fields", () => {
  reset();
  cp.setActive(true);
  cp.emitContent({ app: "Chrome", kind: "search", text: "   " });
  cp.emitContent({ app: "Chrome", kind: "weird", text: "ok" });
  assert.equal(cp._queueLength(), 1); // only the valid one
});

test("flushOnce posts the batch and drops accepted ids on ok", async () => {
  reset();
  cp.updateContentConfig({
    contentFlushIntervalSeconds: 30,
    apiBaseUrl: "http://x",
    agentUuid: "u",
    agentSecret: "s",
  });
  cp.setActive(true);
  cp.emitContent({ app: "Chrome", kind: "search", text: "keep" });

  // stub the client
  const contentClient = require("../src/api/contentClient");
  const orig = contentClient.postContent;
  contentClient.postContent = async (_cfg, items) => ({
    kind: "ok",
    acceptedIds: items.map((i) => i.client_event_id),
    inserted: items.length,
    dropped: [],
  });
  try {
    const res = await cp.flushOnce();
    assert.equal(res.kind, "ok");
    assert.equal(cp._queueLength(), 0);
  } finally {
    contentClient.postContent = orig;
  }
});

test("a 501/403 from the server clears the queue AND deactivates", async () => {
  reset();
  cp.updateContentConfig({
    contentFlushIntervalSeconds: 30,
    apiBaseUrl: "http://x",
    agentUuid: "u",
    agentSecret: "s",
  });
  cp.setActive(true);
  cp.emitContent({ app: "Chrome", kind: "search", text: "drop me" });

  const contentClient = require("../src/api/contentClient");
  const orig = contentClient.postContent;
  contentClient.postContent = async () => ({ kind: "disabled", status: 501 });
  try {
    const res = await cp.flushOnce();
    assert.equal(res.kind, "disabled");
    assert.equal(cp._queueLength(), 0);
    assert.equal(cp.isActive(), false);
  } finally {
    contentClient.postContent = orig;
  }
});

test("network failure holds the batch (does not lose it)", async () => {
  reset();
  cp.updateContentConfig({
    contentFlushIntervalSeconds: 30,
    apiBaseUrl: "http://x",
    agentUuid: "u",
    agentSecret: "s",
  });
  cp.setActive(true);
  cp.emitContent({ app: "Chrome", kind: "search", text: "held" });

  const contentClient = require("../src/api/contentClient");
  const orig = contentClient.postContent;
  contentClient.postContent = async () => ({ kind: "network" });
  try {
    const res = await cp.flushOnce();
    assert.equal(res.kind, "network");
    assert.equal(cp._queueLength(), 1); // still queued
    assert.equal(cp.isActive(), true);
  } finally {
    contentClient.postContent = orig;
  }
});
