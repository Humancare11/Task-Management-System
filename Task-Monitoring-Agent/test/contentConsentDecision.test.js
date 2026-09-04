"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { decideContentAction } = require("../src/monitoring/contentConsentDecision");

const NEVER = () => false;
const ALWAYS = () => true;

const needConsentSignal = (over = {}) => ({
  active: false,
  legal_gate_open: false,
  org_enabled: true,
  consent_required: true,
  consented: false,
  document_version: "2026-09-04.v1",
  document_title: "Notice & Consent",
  document_text: "We will record your search terms and AI prompts on 5 sites...",
  ...over,
});

test("no signal -> capture off, no prompt", () => {
  assert.deepEqual(decideContentAction(null, { hasLocalConsent: NEVER }), {
    capture: "off",
    prompt: null,
    cacheConsent: false,
  });
});

test("org not enabled (consent_required false) -> off, no prompt", () => {
  const d = decideContentAction(
    needConsentSignal({ org_enabled: false, consent_required: false, document_text: undefined }),
    { hasLocalConsent: NEVER }
  );
  assert.equal(d.capture, "off");
  assert.equal(d.prompt, null);
});

test("consent needed + notice text present -> prompt with the exact document", () => {
  const s = needConsentSignal();
  const d = decideContentAction(s, { promptedVersion: null, hasLocalConsent: NEVER });
  assert.equal(d.capture, "off");
  assert.deepEqual(d.prompt, {
    version: "2026-09-04.v1",
    title: "Notice & Consent",
    text: s.document_text,
  });
});

test("consent needed but NO notice text -> no prompt (fail safe)", () => {
  const d = decideContentAction(
    needConsentSignal({ document_text: undefined }),
    { hasLocalConsent: NEVER }
  );
  assert.equal(d.prompt, null);
});

test("already prompted this version this session -> no re-prompt", () => {
  const d = decideContentAction(needConsentSignal(), {
    promptedVersion: "2026-09-04.v1",
    hasLocalConsent: NEVER,
  });
  assert.equal(d.prompt, null);
});

test("local consent cache for this version -> no prompt", () => {
  const d = decideContentAction(needConsentSignal(), { hasLocalConsent: ALWAYS });
  assert.equal(d.prompt, null);
});

test("declining just keeps returning 'off' with no capture", () => {
  // simulate: user declined, heartbeats keep coming with consented:false
  const s = needConsentSignal();
  const first = decideContentAction(s, { promptedVersion: null, hasLocalConsent: NEVER });
  assert.ok(first.prompt); // shown once
  const afterDecline = decideContentAction(s, {
    promptedVersion: s.document_version,
    hasLocalConsent: NEVER,
  });
  assert.equal(afterDecline.capture, "off");
  assert.equal(afterDecline.prompt, null); // not nagged again this session
});

test("signal.active === true -> capture on; cache consent if not cached locally", () => {
  const d = decideContentAction(
    { active: true, document_version: "2026-09-04.v1", consent_required: true, consented: true },
    { hasLocalConsent: NEVER }
  );
  assert.equal(d.capture, "on");
  assert.equal(d.prompt, null);
  assert.equal(d.cacheConsent, true);
});

test("signal.active === true + already cached locally -> on, no redundant cache write", () => {
  const d = decideContentAction(
    { active: true, document_version: "2026-09-04.v1" },
    { hasLocalConsent: ALWAYS }
  );
  assert.equal(d.capture, "on");
  assert.equal(d.cacheConsent, false);
});

test("a version bump re-triggers the prompt even if an older version was cached", () => {
  const cachedOld = (v) => v === "2026-09-04.v1";
  const d = decideContentAction(
    needConsentSignal({ document_version: "2026-11-01.v2" }),
    { promptedVersion: "2026-09-04.v1", hasLocalConsent: cachedOld }
  );
  assert.ok(d.prompt);
  assert.equal(d.prompt.version, "2026-11-01.v2");
});
