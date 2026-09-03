"use strict";

// Phase 5 cutover: pipelineMode decides whether the agent writes the legacy
// POST /agent/activities path, the raw event pipeline, or both.

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildConfig } = require("../src/config/config");

const BASE = { apiBaseUrl: "http://x", agentUuid: "u", agentSecret: "s" };

function mode(env = {}, fb = {}) {
  for (const k of ["PIPELINE_MODE", "EVENTS_PIPELINE_ENABLED", "AGENT_CONFIG_PATH"]) {
    delete process.env[k];
  }
  Object.assign(process.env, env);
  const c = buildConfig({ ...BASE, ...fb });
  for (const k of Object.keys(env)) delete process.env[k];
  return {
    pipelineMode: c.pipelineMode,
    events: c.eventsPipelineEnabled,
    legacy: c.legacyActivitiesEnabled,
  };
}

test("default is events-only (legacy /activities OFF)", () => {
  assert.deepEqual(mode(), { pipelineMode: "events", events: true, legacy: false });
});

test('PIPELINE_MODE=dual keeps both paths', () => {
  assert.deepEqual(mode({ PIPELINE_MODE: "dual" }), {
    pipelineMode: "dual",
    events: true,
    legacy: true,
  });
});

test('PIPELINE_MODE=legacy is the revert path (events OFF)', () => {
  assert.deepEqual(mode({ PIPELINE_MODE: "legacy" }), {
    pipelineMode: "legacy",
    events: false,
    legacy: true,
  });
});

test("EVENTS_PIPELINE_ENABLED=false is a hard override -> legacy-only", () => {
  assert.deepEqual(mode({ EVENTS_PIPELINE_ENABLED: "false" }), {
    pipelineMode: "legacy",
    events: false,
    legacy: true,
  });
  // even when a mode is also set
  assert.deepEqual(
    mode({ PIPELINE_MODE: "events", EVENTS_PIPELINE_ENABLED: "false" }),
    { pipelineMode: "legacy", events: false, legacy: true }
  );
});

test("unknown PIPELINE_MODE falls back to events-only", () => {
  assert.deepEqual(mode({ PIPELINE_MODE: "banana" }), {
    pipelineMode: "events",
    events: true,
    legacy: false,
  });
});

test("fallback object (Electron setup UI) can set pipelineMode", () => {
  assert.deepEqual(mode({}, { pipelineMode: "dual" }), {
    pipelineMode: "dual",
    events: true,
    legacy: true,
  });
});

test("the agent is never left blind (events off implies legacy on)", () => {
  for (const m of ["events", "dual", "legacy", "nonsense"]) {
    const r = mode({ PIPELINE_MODE: m });
    assert.ok(r.events || r.legacy, `mode=${m} left both paths off`);
  }
});
