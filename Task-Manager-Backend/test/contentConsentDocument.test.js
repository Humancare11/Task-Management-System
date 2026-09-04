"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const doc = require("../config/contentConsentDocument");
const gate = require("../config/contentCaptureGate");

test("consent document exports a sortable version, a title, and non-trivial text", () => {
  assert.equal(typeof doc.CONTENT_CONSENT_DOCUMENT_VERSION, "string");
  assert.ok(doc.CONTENT_CONSENT_DOCUMENT_VERSION.length >= 3);
  assert.notEqual(doc.CONTENT_CONSENT_DOCUMENT_VERSION, "draft-unapproved");
  assert.equal(typeof doc.CONTENT_CONSENT_DOCUMENT_TITLE, "string");
  assert.ok(doc.CONTENT_CONSENT_DOCUMENT_TITLE.length > 0);
  assert.equal(typeof doc.CONTENT_CONSENT_DOCUMENT_TEXT, "string");
  assert.ok(doc.CONTENT_CONSENT_DOCUMENT_TEXT.length > 400);
});

test("v2: version reflects the widened (all-site) scope", () => {
  assert.equal(doc.CONTENT_CONSENT_DOCUMENT_VERSION, "2026-09-04.v2");
});

test("the notice covers what it must (search + prompts, exclusions, choice)", () => {
  const t = doc.CONTENT_CONSENT_DOCUMENT_TEXT.toLowerCase();
  for (const phrase of [
    "search",
    "prompt",
    "password",
    "incognito",
    "encrypted",
    "deleted",
    "decline",
    "withdraw",
  ]) {
    assert.ok(t.includes(phrase), `notice should mention "${phrase}"`);
  }
});

test("the notice still names the always-excluded protected categories", () => {
  const t = doc.CONTENT_CONSENT_DOCUMENT_TEXT.toLowerCase();
  for (const phrase of ["banking", "payment", "healthcare", "government"]) {
    assert.ok(t.includes(phrase), `notice should name the excluded category "${phrase}"`);
  }
});

test("the notice describes any-website search scope, not a fixed 5-site list", () => {
  const t = doc.CONTENT_CONSENT_DOCUMENT_TEXT.toLowerCase();
  assert.ok(
    t.includes("any website") || t.includes("any site"),
    "notice should state search queries are recorded on any website",
  );
});

test("contentCaptureGate re-exports the SAME version (no drift)", () => {
  assert.equal(
    gate.CONTENT_CONSENT_DOCUMENT_VERSION,
    doc.CONTENT_CONSENT_DOCUMENT_VERSION
  );
});

test("the legal gate is open for the widened (all-site) scope + v2 notice", () => {
  assert.equal(gate.CONTENT_CAPTURE_LEGALLY_APPROVED, true);
});
