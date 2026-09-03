"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyTarget,
  looksPrivate,
  reduceQuery,
} = require("../src/monitoring/contentCapture");
const { matchesBlocklist } = require("../src/monitoring/contentBlocklistClient");

test("classifyTarget: only the curated allowlist", () => {
  assert.equal(classifyTarget("google.com").kind, "search");
  assert.equal(classifyTarget("www.youtube.com").kind, "search");
  assert.equal(classifyTarget("chatgpt.com").kind, "prompt");
  assert.equal(classifyTarget("claude.ai").kind, "prompt");
  assert.equal(classifyTarget("gemini.google.com").kind, "prompt");
  assert.equal(classifyTarget("bing.com"), null);
  assert.equal(classifyTarget("mail.google.com"), null); // gmail is not a target
  assert.equal(classifyTarget(""), null);
});

test("looksPrivate detects incognito / InPrivate / private windows", () => {
  assert.equal(looksPrivate("YouTube — Google Chrome (Incognito)"), true);
  assert.equal(looksPrivate("Bing — Microsoft Edge InPrivate"), true);
  assert.equal(looksPrivate("Search — Mozilla Firefox (Private Browsing)"), true);
  assert.equal(looksPrivate("YouTube — Google Chrome"), false);
  assert.equal(looksPrivate(""), false);
});

test("agent blocklist blocks banking / gov / payment (hardcoded fallback)", () => {
  assert.equal(matchesBlocklist("secure.chase.com"), true);
  assert.equal(matchesBlocklist("irs.gov"), true);
  assert.equal(matchesBlocklist("paypal.com"), true);
  assert.equal(matchesBlocklist("google.com"), false);
  assert.equal(matchesBlocklist(""), true); // fail closed
});

// --- debounce: emit on clear / target-change / focus-loss, not on each poll ---

test("reduceQuery: no emit while the query is still being typed", () => {
  let s = { pending: "", targetKey: "" };
  let r = reduceQuery(s, { text: "how to", targetKey: "chrome|google.com" });
  assert.equal(r.emit, null);
  s = r.state;
  r = reduceQuery(s, { text: "how to center a div", targetKey: "chrome|google.com" });
  assert.equal(r.emit, null);
  assert.equal(r.state.pending, "how to center a div");
});

test("reduceQuery: emits the last value when the field clears (submit/navigate)", () => {
  let s = { pending: "lofi hip hop", targetKey: "chrome|youtube.com" };
  const r = reduceQuery(s, { text: "", targetKey: "chrome|youtube.com" });
  assert.equal(r.emit, "lofi hip hop");
  assert.equal(r.state.pending, "");
});

test("reduceQuery: emits when the target changes", () => {
  const s = { pending: "explain useEffect", targetKey: "chrome|chatgpt.com" };
  const r = reduceQuery(s, { text: "", targetKey: "chrome|google.com" });
  assert.equal(r.emit, "explain useEffect");
  assert.equal(r.state.targetKey, "chrome|google.com");
});

test("reduceQuery: emits when focus leaves the browser (text null)", () => {
  const s = { pending: "quarterly report", targetKey: "chrome|google.com" };
  const r = reduceQuery(s, { text: null, targetKey: null });
  assert.equal(r.emit, "quarterly report");
});

test("reduceQuery: nothing pending -> nothing emitted on clear", () => {
  const s = { pending: "", targetKey: "chrome|google.com" };
  const r = reduceQuery(s, { text: "", targetKey: "chrome|google.com" });
  assert.equal(r.emit, null);
});
