"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const client = require("../src/monitoring/screenshot/screenshotClient");

const CONFIG = { apiBaseUrl: "http://x/api", agentUuid: "u", agentSecret: "s" };

function stubFetch(handler) {
  const original = global.fetch;
  global.fetch = async (url, opts) => handler(url, JSON.parse(opts.body));
  return () => {
    global.fetch = original;
  };
}
const res = (status, data) => ({ status, json: async () => data });

test("poll: 200 -> directive; 501 -> disabled; 401 -> auth; 500 -> http", async () => {
  let restore = stubFetch(() => res(200, { action: "capture", request_id: "r1" }));
  assert.deepEqual(await client.poll(CONFIG), {
    kind: "ok",
    directive: { action: "capture", request_id: "r1" },
  });
  restore();

  restore = stubFetch(() => res(501, { message: "not enabled" }));
  assert.deepEqual(await client.poll(CONFIG), { kind: "disabled" });
  restore();

  restore = stubFetch(() => res(401, {}));
  assert.deepEqual(await client.poll(CONFIG), { kind: "auth" });
  restore();

  restore = stubFetch(() => res(500, {}));
  assert.deepEqual(await client.poll(CONFIG), { kind: "http", status: 500 });
  restore();
});

test("poll: network failure -> {kind:'network'} (never throws)", async () => {
  const restore = stubFetch(() => {
    const { NetworkError } = require("../src/api/apiClient");
    throw new NetworkError("ECONNREFUSED");
  });
  assert.deepEqual(await client.poll(CONFIG), { kind: "network" });
  restore();
});

test("upload: sends creds + request_id + image_base64, never an error field on success", async () => {
  let seen = null;
  const restore = stubFetch((_url, body) => {
    seen = body;
    return res(200, { ok: true });
  });
  const r = await client.upload(CONFIG, { requestId: "r1", imageBase64: "aGVsbG8=" });
  restore();
  assert.equal(r.kind, "ok");
  assert.equal(seen.agent_uuid, "u");
  assert.equal(seen.agent_secret, "s");
  assert.equal(seen.request_id, "r1");
  assert.equal(seen.image_base64, "aGVsbG8=");
  assert.equal(seen.error, undefined);
});

test("upload: an error report sends `error`, not `image_base64`", async () => {
  let seen = null;
  const restore = stubFetch((_url, body) => {
    seen = body;
    return res(200, { ok: true });
  });
  await client.upload(CONFIG, { requestId: "r1", error: "capture_failed" });
  restore();
  assert.equal(seen.request_id, "r1");
  assert.equal(seen.error, "capture_failed");
  assert.equal(seen.image_base64, undefined);
});

test("upload: 501 -> disabled, 401 -> auth, 409 -> http", async () => {
  let restore = stubFetch(() => res(501, {}));
  assert.deepEqual(await client.upload(CONFIG, { requestId: "r1", imageBase64: "x" }), {
    kind: "disabled",
  });
  restore();

  restore = stubFetch(() => res(401, {}));
  assert.deepEqual(await client.upload(CONFIG, { requestId: "r1", imageBase64: "x" }), {
    kind: "auth",
  });
  restore();

  restore = stubFetch(() => res(409, { message: "no_request" }));
  assert.deepEqual(await client.upload(CONFIG, { requestId: "r1", imageBase64: "x" }), {
    kind: "http",
    status: 409,
  });
  restore();
});

test("upload: network failure -> {kind:'network'} (never throws)", async () => {
  const restore = stubFetch(() => {
    const { NetworkError } = require("../src/api/apiClient");
    throw new NetworkError("ECONNREFUSED");
  });
  assert.deepEqual(await client.upload(CONFIG, { requestId: "r1", imageBase64: "x" }), {
    kind: "network",
  });
  restore();
});
