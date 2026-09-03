"use strict";

/**
 * contentCrypto — versioned AES-256-GCM for §5b captured content.
 *
 * Keys live in a small registry so rotation never strands old rows: every
 * ciphertext stores the `key_version` it was written with, and decryption looks
 * that version up. To rotate: add a new key to the registry and point
 * MONITORING_CONTENT_KEY_ACTIVE at it; existing rows keep decrypting under their
 * original version.
 *
 * Environment:
 *   MONITORING_CONTENT_KEYS        JSON object { "<version>": "<base64 32 bytes>" }
 *   MONITORING_CONTENT_KEY_ACTIVE  the version new rows are encrypted with
 *
 * This module is inert until Phase 4 — nothing calls encrypt()/decrypt() yet.
 * When the registry is not configured, isConfigured() returns false and
 * encrypt() throws (it never silently no-ops or writes plaintext).
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // standard GCM nonce length
const AUTH_TAG_BYTES = 16;

let cachedRegistry;

function parseRegistry() {
  const raw = process.env.MONITORING_CONTENT_KEYS;
  if (!raw || !raw.trim()) {
    return { keys: Object.create(null), active: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`MONITORING_CONTENT_KEYS is not valid JSON: ${err.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("MONITORING_CONTENT_KEYS must be a JSON object of { version: base64Key }");
  }

  const keys = Object.create(null);
  for (const [version, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`MONITORING_CONTENT_KEYS["${version}"] must be a base64 string`);
    }
    const buf = Buffer.from(value, "base64");
    if (buf.length !== KEY_BYTES) {
      throw new Error(
        `MONITORING_CONTENT_KEYS["${version}"] must decode to ${KEY_BYTES} bytes (got ${buf.length})`
      );
    }
    keys[version] = buf;
  }

  const active = (process.env.MONITORING_CONTENT_KEY_ACTIVE || "").trim() || null;
  if (active && !keys[active]) {
    throw new Error(
      `MONITORING_CONTENT_KEY_ACTIVE "${active}" is not present in MONITORING_CONTENT_KEYS`
    );
  }

  return { keys, active };
}

function registry() {
  if (!cachedRegistry) cachedRegistry = parseRegistry();
  return cachedRegistry;
}

/** Clear the cached registry — for tests / after an env change. */
function _resetCache() {
  cachedRegistry = undefined;
}

/** True when there is an active key available to encrypt new rows. */
function isConfigured() {
  try {
    const reg = registry();
    return Boolean(reg.active && reg.keys[reg.active]);
  } catch {
    return false;
  }
}

/** Versions the registry can currently decrypt. */
function availableKeyVersions() {
  return Object.keys(registry().keys);
}

function toBuffer(value, label) {
  if (Buffer.isBuffer(value)) return value;
  if (value && value.type === "Buffer" && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError(`contentCrypto: ${label} must be a Buffer`);
}

/**
 * @param {string} plaintext
 * @returns {{ ciphertext: Buffer, iv: Buffer, authTag: Buffer, keyVersion: string }}
 */
function encrypt(plaintext) {
  const reg = registry();
  if (!reg.active || !reg.keys[reg.active]) {
    throw new Error("contentCrypto: no active encryption key configured");
  }
  const key = reg.keys[reg.active];
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag, keyVersion: reg.active };
}

/**
 * @param {{ ciphertext: *, iv: *, authTag: *, keyVersion: string }} row
 * @returns {string} the decrypted UTF-8 plaintext
 */
function decrypt({ ciphertext, iv, authTag, keyVersion }) {
  const reg = registry();
  const key = reg.keys[keyVersion];
  if (!key) {
    throw new Error(
      `contentCrypto: decryption key "${keyVersion}" is not available in the current registry`
    );
  }
  const ivBuf = toBuffer(iv, "iv");
  const tagBuf = toBuffer(authTag, "authTag");
  if (tagBuf.length !== AUTH_TAG_BYTES) {
    throw new Error(`contentCrypto: auth tag must be ${AUTH_TAG_BYTES} bytes`);
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(tagBuf);
  const plaintext = Buffer.concat([
    decipher.update(toBuffer(ciphertext, "ciphertext")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

module.exports = {
  ALGORITHM,
  KEY_BYTES,
  IV_BYTES,
  isConfigured,
  availableKeyVersions,
  encrypt,
  decrypt,
  _resetCache,
};
