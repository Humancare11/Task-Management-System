"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const client = require("../src/monitoring/liveScreen/liveScreenClient");

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
  let restore = stubFetch(() => res(200, { action: "start", session_id: "s1" }));
  assert.deepEqual(await client.poll(CONFIG), {
    kind: "ok",
    directive: { action: "start", session_id: "s1" },
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

test("signal: sends creds + message; 200 -> ok with data", async () => {
  let seen = null;
  const restore = stubFetch((_url, body) => {
    seen = body;
    return res(200, { ok: true, answer: "ANSWER", viewer_ice: [] });
  });
  const r = await client.signal(CONFIG, { session_id: "s1", type: "offer", sdp: "OFFER" });
  restore();
  assert.equal(r.kind, "ok");
  assert.equal(r.data.answer, "ANSWER");
  assert.equal(seen.agent_uuid, "u");
  assert.equal(seen.agent_secret, "s");
  assert.equal(seen.type, "offer");
  assert.equal(seen.sdp, "OFFER");
});

test("signal: 501 -> disabled, 409 -> http", async () => {
  let restore = stubFetch(() => res(501, {}));
  assert.deepEqual(await client.signal(CONFIG, { type: "offer" }), { kind: "disabled" });
  restore();
  restore = stubFetch(() => res(409, { message: "no_session" }));
  assert.deepEqual(await client.signal(CONFIG, { type: "offer" }), { kind: "http", status: 409 });
  restore();
});
