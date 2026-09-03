"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeHost,
  patternMatches,
  matchesBlocklist,
  HARDCODED_BLOCKLIST,
} = require("../utils/contentBlocklist");

test("normalizeHost strips scheme / path / port / www / creds", () => {
  assert.equal(normalizeHost("https://www.Example.com:443/path?q=1"), "example.com");
  assert.equal(normalizeHost("user:pw@sub.example.com"), "sub.example.com");
  assert.equal(normalizeHost("EXAMPLE.COM."), "example.com");
  assert.equal(normalizeHost(""), null);
  assert.equal(normalizeHost(null), null);
});

test("patternMatches: bare domain covers itself + subdomains only", () => {
  assert.equal(patternMatches("chase.com", "chase.com"), true);
  assert.equal(patternMatches("chase.com", "secure.chase.com"), true);
  assert.equal(patternMatches("chase.com", "notchase.com"), false);
  assert.equal(patternMatches("chase.com", "chase.com.evil.com"), false);
});

test("patternMatches: *.example.com covers subdomains and the apex", () => {
  assert.equal(patternMatches("*.mychart.com", "mychart.com"), true);
  assert.equal(patternMatches("*.mychart.com", "abc.mychart.com"), true);
  assert.equal(patternMatches("*.mychart.com", "mychart.com.co"), false);
});

test("patternMatches: TLD wildcard *.gov / *.gov.in", () => {
  assert.equal(patternMatches("*.gov", "irs.gov"), true);
  assert.equal(patternMatches("*.gov", "www.irs.gov"), true);
  assert.equal(patternMatches("*.gov", "govern.com"), false);
  assert.equal(patternMatches("*.gov.in", "uidai.gov.in"), true);
  assert.equal(patternMatches("*.gov.in", "uidai.gov.in.example.com"), false);
});

test("matchesBlocklist uses the hardcoded fallback when no patterns given", () => {
  assert.equal(matchesBlocklist("secure.chase.com", null), true);
  assert.equal(matchesBlocklist("paypal.com", []), true);
  assert.equal(matchesBlocklist("anytax.gov.uk", undefined), true);
  assert.equal(matchesBlocklist("news.ycombinator.com", null), false);
  assert.equal(matchesBlocklist("youtube.com", HARDCODED_BLOCKLIST), false);
});

test("matchesBlocklist refuses an unknown/empty host (fail closed)", () => {
  assert.equal(matchesBlocklist("", ["example.com"]), true);
  assert.equal(matchesBlocklist(null, ["example.com"]), true);
});

test("matchesBlocklist honours extra DB patterns", () => {
  assert.equal(matchesBlocklist("internal-payroll.acme.com", ["*.acme.com"]), true);
  assert.equal(matchesBlocklist("acme.com", ["acme.com"]), true);
});
