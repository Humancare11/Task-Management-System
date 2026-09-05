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

test("setActive(false) clears the local queue immediately (synchronously)", async () => {
  reset();
  cp.updateContentConfig({
    contentFlushIntervalSeconds: 30,
    apiBaseUrl: "http://x",
    agentUuid: "u",
    agentSecret: "s",
  });
  // Stub so the best-effort save attempt below (fire-and-forget) never makes
  // a real network call during this test.
  const contentClient = require("../src/api/contentClient");
  const orig = contentClient.postContent;
  let resolvePost;
  contentClient.postContent = () => new Promise((r) => { resolvePost = r; });
  try {
    cp.setActive(true);
    cp.emitContent({ app: "Chrome", kind: "search", text: "a" });
    cp.emitContent({ app: "Chrome", kind: "prompt", text: "b" });
    assert.equal(cp._queueLength(), 2);

    cp.setActive(false);
    // The local queue is dropped synchronously, before the best-effort save
    // attempt below has any chance to resolve.
    assert.equal(cp._queueLength(), 0);
    assert.equal(cp.isActive(), false);

    resolvePost({ kind: "ok", acceptedIds: [], inserted: 0, dropped: [] });
    await Promise.resolve(); // let the fire-and-forget flush settle
  } finally {
    contentClient.postContent = orig;
  }
});

test("setActive(false) tries once to save the queue before dropping it — a successful save reaches the server", async () => {
  reset();
  cp.updateContentConfig({
    contentFlushIntervalSeconds: 30,
    apiBaseUrl: "http://x",
    agentUuid: "u",
    agentSecret: "s",
  });
  cp.setActive(true);
  cp.emitContent({ app: "Chrome", kind: "search", text: "please save me" });

  const contentClient = require("../src/api/contentClient");
  const orig = contentClient.postContent;
  let seenItems = null;
  let settle;
  const settled = new Promise((r) => { settle = r; });
  contentClient.postContent = async (_cfg, items) => {
    seenItems = items;
    settle();
    return { kind: "ok", acceptedIds: items.map((i) => i.client_event_id), inserted: items.length, dropped: [] };
  };
  try {
    cp.setActive(false);
    assert.equal(cp._queueLength(), 0); // dropped locally right away
    await settled; // ...but the best-effort save still went out
    assert.ok(seenItems && seenItems.length === 1 && seenItems[0].text === "please save me");
    await Promise.resolve();
    await Promise.resolve(); // let flushOnce's own continuation (flushing=false) settle
  } finally {
    contentClient.postContent = orig;
  }
});

test("setActive(false) with a failing best-effort save is no worse than before — no throw, queue still cleared", async () => {
  reset();
  cp.updateContentConfig({
    contentFlushIntervalSeconds: 30,
    apiBaseUrl: "http://x",
    agentUuid: "u",
    agentSecret: "s",
  });
  cp.setActive(true);
  cp.emitContent({ app: "Chrome", kind: "search", text: "network is down" });

  const contentClient = require("../src/api/contentClient");
  const orig = contentClient.postContent;
  contentClient.postContent = async () => ({ kind: "network" });
  try {
    assert.doesNotThrow(() => cp.setActive(false));
    assert.equal(cp._queueLength(), 0);
    assert.equal(cp.isActive(), false);
    await Promise.resolve();
    await Promise.resolve(); // let the fire-and-forget attempt settle
  } finally {
    contentClient.postContent = orig;
  }
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
