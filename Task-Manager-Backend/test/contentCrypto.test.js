"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const cc = require("../utils/contentCrypto");

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  cc._resetCache();
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    cc._resetCache();
  }
}

const key = (n) => crypto.randomBytes(n).toString("base64");

test("isConfigured false when no env", () => {
  withEnv(
    { MONITORING_CONTENT_KEYS: undefined, MONITORING_CONTENT_KEY_ACTIVE: undefined },
    () => {
      assert.equal(cc.isConfigured(), false);
      assert.throws(() => cc.encrypt("x"), /no active encryption key/);
    }
  );
});

test("encrypt/decrypt round-trip under the active key", () => {
  withEnv(
    {
      MONITORING_CONTENT_KEYS: JSON.stringify({ v1: key(32) }),
      MONITORING_CONTENT_KEY_ACTIVE: "v1",
    },
    () => {
      assert.equal(cc.isConfigured(), true);
      const enc = cc.encrypt("explain useEffect");
      assert.equal(enc.keyVersion, "v1");
      assert.equal(enc.iv.length, cc.IV_BYTES);
      const out = cc.decrypt(enc);
      assert.equal(out, "explain useEffect");
    }
  );
});

test("old rows still decrypt after rotation to a new active key", () => {
  const k1 = key(32);
  const k2 = key(32);
  let encV1;
  withEnv(
    {
      MONITORING_CONTENT_KEYS: JSON.stringify({ v1: k1 }),
      MONITORING_CONTENT_KEY_ACTIVE: "v1",
    },
    () => {
      encV1 = cc.encrypt("secret one");
    }
  );
  withEnv(
    {
      MONITORING_CONTENT_KEYS: JSON.stringify({ v1: k1, v2: k2 }),
      MONITORING_CONTENT_KEY_ACTIVE: "v2",
    },
    () => {
      // new rows use v2
      assert.equal(cc.encrypt("secret two").keyVersion, "v2");
      // old v1 row still readable
      assert.equal(cc.decrypt(encV1), "secret one");
    }
  );
});

test("decrypt throws clearly when the key version is gone", () => {
  withEnv(
    {
      MONITORING_CONTENT_KEYS: JSON.stringify({ v2: key(32) }),
      MONITORING_CONTENT_KEY_ACTIVE: "v2",
    },
    () => {
      assert.throws(
        () =>
          cc.decrypt({
            ciphertext: Buffer.from("00", "hex"),
            iv: Buffer.alloc(12),
            authTag: Buffer.alloc(16),
            keyVersion: "v1",
          }),
        /"v1" is not available/
      );
    }
  );
});

test("bad config is rejected loudly", () => {
  withEnv({ MONITORING_CONTENT_KEYS: "{not json" }, () => {
    assert.equal(cc.isConfigured(), false); // isConfigured swallows
    assert.throws(() => cc.encrypt("x"), /not valid JSON/);
  });
  withEnv(
    { MONITORING_CONTENT_KEYS: JSON.stringify({ v1: Buffer.alloc(10).toString("base64") }) },
    () => {
      assert.throws(() => cc.encrypt("x"), /32 bytes/);
    }
  );
});

test("tampered ciphertext fails the GCM auth check", () => {
  withEnv(
    {
      MONITORING_CONTENT_KEYS: JSON.stringify({ v1: key(32) }),
      MONITORING_CONTENT_KEY_ACTIVE: "v1",
    },
    () => {
      const enc = cc.encrypt("hello");
      const tampered = Buffer.from(enc.ciphertext);
      tampered[0] ^= 0xff;
      assert.throws(() => cc.decrypt({ ...enc, ciphertext: tampered }));
    }
  );
});
