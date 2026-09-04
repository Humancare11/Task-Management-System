"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeHost,
  normalizeDomain,
  registrableDomainFromHost,
} = require("../src/monitoring/domainDetector");
const { classifyTarget } = require("../src/monitoring/contentCapture");

// --- normalizeHost: full host, www stripped, junk rejected --------------

test("normalizeHost: keeps the full host, strips scheme/path/query and www", () => {
  assert.equal(normalizeHost("https://www.google.com/search?q=hello"), "google.com");
  assert.equal(normalizeHost("https://gemini.google.com/app"), "gemini.google.com");
  assert.equal(normalizeHost("https://chat.openai.com/c/123"), "chat.openai.com");
  assert.equal(normalizeHost("mail.google.com"), "mail.google.com");
  assert.equal(normalizeHost("https://EN.Wikipedia.ORG/wiki/X"), "en.wikipedia.org");
  assert.equal(normalizeHost("https://bbc.co.uk"), "bbc.co.uk");
});

test("normalizeHost: rejects non-web / internal / malformed values", () => {
  assert.equal(normalizeHost(""), null);
  assert.equal(normalizeHost("   "), null);
  assert.equal(normalizeHost("how to center a div"), null);
  assert.equal(normalizeHost("chrome://settings"), null);
  assert.equal(normalizeHost("about:blank"), null);
  assert.equal(normalizeHost("localhost"), null);
  assert.equal(normalizeHost("http://localhost:3000"), null);
  assert.equal(normalizeHost(null), null);
});

// --- registrableDomainFromHost ----------------------------------------

test("registrableDomainFromHost: last two labels, three for known ccTLDs", () => {
  assert.equal(registrableDomainFromHost("gemini.google.com"), "google.com");
  assert.equal(registrableDomainFromHost("google.com"), "google.com");
  assert.equal(registrableDomainFromHost("a.b.c.example.com"), "example.com");
  assert.equal(registrableDomainFromHost("news.bbc.co.uk"), "bbc.co.uk");
  assert.equal(registrableDomainFromHost("shop.example.co.in"), "example.co.in");
});

// --- normalizeDomain: UNCHANGED behavior (events pipeline depends on it) --

test("normalizeDomain: still collapses to the registrable domain (regression)", () => {
  assert.equal(normalizeDomain("https://www.youtube.com/results?search_query=cats"), "youtube.com");
  assert.equal(normalizeDomain("https://youtube.com/watch?v=abc"), "youtube.com");
  assert.equal(normalizeDomain("https://gemini.google.com/app"), "google.com");
  assert.equal(normalizeDomain("https://chat.openai.com/c/1"), "openai.com");
  assert.equal(normalizeDomain("https://sub.domain.example.co.uk/x"), "example.co.uk");
  assert.equal(normalizeDomain("not a url"), null);
});

// --- integration: address-bar normalization -> capture classification ---
// (the coverage gap that previously hid the Gemini / chat.openai.com bugs)

const editField = (over = {}) => ({
  controlType: "ControlType.Edit",
  name: "",
  automationId: "",
  ariaRole: "",
  localizedControlType: "",
  isPassword: false,
  ...over,
});
const promptField = () => editField({ controlType: "ControlType.Document" });
const searchField = () => editField({ ariaRole: "searchbox" });

function classifyUrl(url, field) {
  const host = normalizeHost(url);
  const reg = normalizeDomain(url);
  return classifyTarget(host, reg, field);
}

test("integration: the 5 originally-supported sites classify correctly end to end", () => {
  assert.equal(classifyUrl("https://www.google.com/search?q=x", editField({ name: "q" })).kind, "search");
  assert.equal(classifyUrl("https://www.youtube.com/results?search_query=x", editField({ name: "search_query" })).kind, "search");
  assert.equal(classifyUrl("https://chatgpt.com/c/1", promptField()).kind, "prompt");
  assert.equal(classifyUrl("https://chat.openai.com/c/1", promptField()).kind, "prompt");
  assert.equal(classifyUrl("https://claude.ai/chat/1", promptField()).kind, "prompt");
  assert.equal(classifyUrl("https://gemini.google.com/app", promptField()).kind, "prompt");
});

test("integration: Gemini is attributed to gemini.google.com, not google.com", () => {
  const t = classifyUrl("https://gemini.google.com/app", promptField());
  assert.equal(t.kind, "prompt");
  assert.equal(t.label, "Gemini");
});

test("integration: arbitrary sites with a search field are captured with the right host", () => {
  for (const [url, field, host] of [
    ["https://www.bing.com/search?q=x", searchField(), "bing.com"],
    ["https://duckduckgo.com/?q=x", editField({ name: "q" }), "duckduckgo.com"],
    ["https://stackoverflow.com/search?q=x", editField({ automationId: "search" }), "stackoverflow.com"],
    ["https://www.amazon.com/s?k=x", editField({ name: "Search Amazon" }), "amazon.com"],
    ["https://github.com/search", editField({ name: "Search or jump to…" }), "github.com"],
  ]) {
    const t = classifyUrl(url, field);
    assert.ok(t, `${url} should classify`);
    assert.equal(t.kind, "search");
    assert.equal(t.label, host);
  }
});

test("integration: a non-search field on an arbitrary site is not captured", () => {
  assert.equal(classifyUrl("https://example.com/signup", editField({ name: "Email" })), null);
  assert.equal(classifyUrl("https://mail.google.com/mail/u/0", promptField()), null); // Document, not a prompt site
});
