"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyTarget,
  classifyPromptSite,
  looksLikeSearchField,
  looksPrivate,
  reduceQuery,
  startContentCapture,
} = require("../src/monitoring/contentCapture");
const { matchesBlocklist } = require("../src/monitoring/contentBlocklistClient");

// --- field metadata helpers ------------------------------------------------

const editField = (over = {}) => ({
  controlType: "ControlType.Edit",
  name: "",
  automationId: "",
  ariaRole: "",
  localizedControlType: "",
  isPassword: false,
  ...over,
});
const searchField = (over = {}) => editField({ ariaRole: "searchbox", ...over });

// --- looksLikeSearchField -------------------------------------------------

test("looksLikeSearchField: aria searchbox / search role", () => {
  assert.equal(looksLikeSearchField(editField({ ariaRole: "searchbox" })), true);
  assert.equal(looksLikeSearchField(editField({ ariaRole: "search" })), true);
});

test("looksLikeSearchField: name/id token 'q' or search/query/keyword", () => {
  assert.equal(looksLikeSearchField(editField({ name: "q" })), true);
  assert.equal(looksLikeSearchField(editField({ automationId: "q" })), true);
  assert.equal(looksLikeSearchField(editField({ name: "Search Amazon" })), true);
  assert.equal(looksLikeSearchField(editField({ automationId: "search_query" })), true);
  assert.equal(looksLikeSearchField(editField({ localizedControlType: "search box" })), true);
  assert.equal(looksLikeSearchField(editField({ name: "Search or jump to…" })), true);
});

test("looksLikeSearchField: rejects non-search fields and password/document", () => {
  assert.equal(looksLikeSearchField(editField({ name: "First name" })), false);
  assert.equal(looksLikeSearchField(editField({ name: "Email address" })), false);
  assert.equal(looksLikeSearchField(editField({ name: "q", isPassword: true })), false);
  assert.equal(
    looksLikeSearchField({ controlType: "ControlType.Document", name: "search" }),
    false,
  );
  assert.equal(looksLikeSearchField(null), false);
});

// --- classifyPromptSite --------------------------------------------------

test("classifyPromptSite: the known assistants by host and registrable domain", () => {
  assert.equal(classifyPromptSite("chatgpt.com", "chatgpt.com").kind, "prompt");
  assert.equal(classifyPromptSite("chat.openai.com", "openai.com").kind, "prompt");
  assert.equal(classifyPromptSite("claude.ai", "claude.ai").kind, "prompt");
  assert.equal(classifyPromptSite("gemini.google.com", "google.com").kind, "prompt");
  // any subdomain of chatgpt.com / claude.ai still counts
  assert.equal(classifyPromptSite("beta.chatgpt.com", "chatgpt.com").kind, "prompt");
});

test("classifyPromptSite: google.com itself is NOT a prompt site", () => {
  assert.equal(classifyPromptSite("google.com", "google.com"), null);
  assert.equal(classifyPromptSite("mail.google.com", "google.com"), null);
  assert.equal(classifyPromptSite("docs.google.com", "google.com"), null);
});

// --- classifyTarget: the 5 originally-supported sites (regression) -------

test("regression: Google search box -> search / google.com", () => {
  const t = classifyTarget("google.com", "google.com", searchField({ name: "q" }));
  assert.equal(t.kind, "search");
  assert.equal(t.label, "google.com");
});

test("regression: YouTube search box -> search / www? youtube.com", () => {
  const t = classifyTarget("youtube.com", "youtube.com", editField({ name: "search_query" }));
  assert.equal(t.kind, "search");
  assert.equal(t.label, "youtube.com");
});

test("regression: ChatGPT prompt box -> prompt (chatgpt.com and chat.openai.com)", () => {
  assert.equal(
    classifyTarget("chatgpt.com", "chatgpt.com", editField({ controlType: "ControlType.Document" })).kind,
    "prompt",
  );
  assert.equal(
    classifyTarget("chat.openai.com", "openai.com", editField({ controlType: "ControlType.Document" })).kind,
    "prompt",
  );
});

test("regression: Claude prompt box -> prompt", () => {
  assert.equal(
    classifyTarget("claude.ai", "claude.ai", editField({ controlType: "ControlType.Document" })).kind,
    "prompt",
  );
});

test("regression: Gemini prompt box -> prompt (was mis-collapsed to google.com before)", () => {
  const t = classifyTarget("gemini.google.com", "google.com", editField({ controlType: "ControlType.Document" }));
  assert.equal(t.kind, "prompt");
  assert.equal(t.label, "Gemini");
});

// --- classifyTarget: search on other websites (the new behavior) --------

for (const [host, reg, meta] of [
  ["bing.com", "bing.com", searchField({ name: "Search" })],
  ["duckduckgo.com", "duckduckgo.com", editField({ name: "q" })],
  ["perplexity.ai", "perplexity.ai", searchField()],
  ["stackoverflow.com", "stackoverflow.com", editField({ automationId: "search" })],
  ["github.com", "github.com", editField({ name: "Search or jump to…" })],
  ["amazon.com", "amazon.com", editField({ name: "Search Amazon" })],
  ["reddit.com", "reddit.com", searchField({ name: "Search Reddit" })],
  ["en.wikipedia.org", "wikipedia.org", editField({ name: "Search Wikipedia" })],
]) {
  test(`all-site: ${host} search field -> search / ${host}`, () => {
    const t = classifyTarget(host, reg, meta);
    assert.ok(t, `${host} should classify`);
    assert.equal(t.kind, "search");
    assert.equal(t.label, host);
  });
}

test("all-site: a non-search field on an arbitrary site -> null", () => {
  assert.equal(classifyTarget("example.com", "example.com", editField({ name: "Full name" })), null);
  assert.equal(classifyTarget("news.ycombinator.com", "ycombinator.com", editField({ controlType: "ControlType.Document", name: "comment text" })), null);
});

test("classifyTarget: no host -> null", () => {
  assert.equal(classifyTarget(null, null, searchField()), null);
  assert.equal(classifyTarget("", "", searchField()), null);
});

// --- looksPrivate --------------------------------------------------------

test("looksPrivate detects incognito / InPrivate / private windows", () => {
  assert.equal(looksPrivate("YouTube — Google Chrome (Incognito)"), true);
  assert.equal(looksPrivate("Bing — Microsoft Edge InPrivate"), true);
  assert.equal(looksPrivate("Search — Mozilla Firefox (Private Browsing)"), true);
  assert.equal(looksPrivate("YouTube — Google Chrome"), false);
  assert.equal(looksPrivate(""), false);
});

// --- blocklist: banking / payment / health / government STAY excluded ---

test("blocklist still blocks banking / payment / health / government (unchanged)", () => {
  assert.equal(matchesBlocklist("secure.chase.com"), true);
  assert.equal(matchesBlocklist("www.wellsfargo.com"), true);
  assert.equal(matchesBlocklist("paypal.com"), true);
  assert.equal(matchesBlocklist("checkout.stripe.com"), true);
  assert.equal(matchesBlocklist("portal.mychart.com"), true);
  assert.equal(matchesBlocklist("irs.gov"), true);
  assert.equal(matchesBlocklist("benefits.ssa.gov"), true);
  assert.equal(matchesBlocklist("anything.gov"), true);
  assert.equal(matchesBlocklist("uidai.gov.in"), true);
  assert.equal(matchesBlocklist("google.com"), false);
  assert.equal(matchesBlocklist("bing.com"), false);
  assert.equal(matchesBlocklist(""), true); // fail closed
});

// --- debounce: emit on clear / target-change / focus-loss, not on each poll ---

test("reduceQuery: no emit while the query is still being typed", () => {
  let s = { pending: "", targetKey: "" };
  let r = reduceQuery(s, { text: "how to", targetKey: "chrome|google.com|search" });
  assert.equal(r.emit, null);
  s = r.state;
  r = reduceQuery(s, { text: "how to center a div", targetKey: "chrome|google.com|search" });
  assert.equal(r.emit, null);
  assert.equal(r.state.pending, "how to center a div");
});

test("reduceQuery: emits the last value when the field clears (submit/navigate)", () => {
  let s = { pending: "lofi hip hop", targetKey: "chrome|youtube.com|search" };
  const r = reduceQuery(s, { text: "", targetKey: "chrome|youtube.com|search" });
  assert.equal(r.emit, "lofi hip hop");
  assert.equal(r.state.pending, "");
});

test("reduceQuery: emits when the target changes", () => {
  const s = { pending: "explain useEffect", targetKey: "chrome|chatgpt.com|prompt" };
  const r = reduceQuery(s, { text: "", targetKey: "chrome|google.com|search" });
  assert.equal(r.emit, "explain useEffect");
  assert.equal(r.state.targetKey, "chrome|google.com|search");
});

test("reduceQuery: emits when focus leaves the browser (text null)", () => {
  const s = { pending: "quarterly report", targetKey: "chrome|google.com|search" };
  const r = reduceQuery(s, { text: null, targetKey: null });
  assert.equal(r.emit, "quarterly report");
});

test("reduceQuery: nothing pending -> nothing emitted on clear", () => {
  const s = { pending: "", targetKey: "chrome|google.com|search" };
  const r = reduceQuery(s, { text: "", targetKey: "chrome|google.com|search" });
  assert.equal(r.emit, null);
});

// --- NEW: capture back-to-back searches on the SAME site (the old lossy case) ---

const KEY = "chrome|google.com|search";
function drive(steps) {
  let s = { pending: "", targetKey: "" };
  const emitted = [];
  for (const text of steps) {
    const r = reduceQuery(s, { text, targetKey: text === null ? null : KEY });
    if (r.emit) emitted.push(r.emit);
    s = r.state;
  }
  return { emitted, state: s };
}

test("reduceQuery: two searches on the same site, box not cleared between them -> BOTH captured", () => {
  // "cats" typed, sits stable for 2 polls (user submitted, reading results),
  // then the box is edited to "dogs" and that is submitted (focus leaves).
  const { emitted } = drive(["ca", "cats", "cats", "cats", "dogs", null]);
  assert.deepEqual(emitted, ["cats", "dogs"]);
});

test("reduceQuery: a divergent second query flushes the first even without a stable pause", () => {
  // "flights" then immediately "hotels" — not a continuation -> "flights" was committed.
  const { emitted } = drive(["flig", "flights", "hotels", null]);
  assert.deepEqual(emitted, ["flights", "hotels"]);
});

test("reduceQuery: refining a query (continuation) within the stable window is ONE query, not two", () => {
  // "cheap" -> "cheap flights" -> "cheap flights to tokyo", typed straight through.
  const { emitted } = drive(["cheap", "cheap flights", "cheap flights to tokyo", ""]);
  assert.deepEqual(emitted, ["cheap flights to tokyo"]);
});

test("reduceQuery: a value already emitted for this field session is not emitted again on clear", () => {
  // "cats" stable, then "cats and kittens" (continuation but stable -> "cats" committed),
  // then the user backspaces to "cats" again, then the box clears.
  const { emitted } = drive([
    "cats", "cats", "cats", "cats and kittens", "cats", "",
  ]);
  // "cats" once (from the stability trigger); "cats and kittens" never sat long
  // enough and "cats" on the clear is suppressed by emittedForKey.
  assert.deepEqual(emitted, ["cats"]);
});

test("reduceQuery: five rapid distinct searches in a row are all captured", () => {
  const { emitted } = drive(["a1", "alpha", "beta", "gamma", "delta", "epsilon", null]);
  assert.deepEqual(emitted, ["alpha", "beta", "gamma", "delta", "epsilon"]);
});

// --- end-to-end tick loop: search -> agent capture (before it leaves the agent) ---

async function harness(blocklist) {
  const emitted = [];
  let cur = { fg: null, field: null };
  const handle = startContentCapture({
    config: { contentPollIntervalSeconds: 3600 }, // never auto-fires during the test
    getForeground: async () => cur.fg,
    readQueryField: async () => cur.field,
    emit: (item) => emitted.push(item),
    blocklistPatterns: () => blocklist,
  });
  // let the immediate tick() fired by startContentCapture settle before driving
  await new Promise((r) => setTimeout(r, 0));
  return {
    emitted,
    async set(fg, field) {
      cur = { fg, field };
      await handle._tick();
    },
    stop: () => handle.stop(),
  };
}

const fg = (host, app = "Google Chrome") => ({
  applicationName: app,
  windowTitle: `${host} — Google Chrome`,
  host,
  registrableDomain: host.split(".").slice(-2).join("."),
  isBrowser: true,
});
const searchInput = (text) => ({ ...editField({ ariaRole: "searchbox" }), text });
const promptInput = (text) => ({ ...editField({ controlType: "ControlType.Document" }), text });

test("flow: Google search -> captured on submit, attributed to google.com", async () => {
  const h = await harness([]);
  await h.set(fg("google.com"), searchInput("laptop reviews"));
  assert.deepEqual(h.emitted, []); // still typing
  await h.set(fg("google.com"), searchInput("")); // submitted -> box cleared
  assert.equal(h.emitted.length, 1);
  assert.equal(h.emitted[0].kind, "search");
  assert.equal(h.emitted[0].domain, "google.com");
  assert.equal(h.emitted[0].text, "laptop reviews");
  h.stop();
});

test("flow: multiple different websites each captured with the right host", async () => {
  const h = await harness([]);
  await h.set(fg("bing.com"), searchInput("weather"));
  await h.set(fg("stackoverflow.com"), searchInput("react useEffect")); // host change flushes bing
  await h.set(fg("youtube.com"), searchInput("lofi")); // flushes stackoverflow
  await h.set(fg("chatgpt.com"), promptInput("explain closures")); // flushes youtube
  await h.set(null, null); // focus leaves browser -> flushes chatgpt prompt
  assert.deepEqual(
    h.emitted.map((e) => [e.domain, e.kind, e.text]),
    [
      ["bing.com", "search", "weather"],
      ["stackoverflow.com", "search", "react useEffect"],
      ["youtube.com", "search", "lofi"],
      ["chatgpt.com", "prompt", "explain closures"],
    ],
  );
  h.stop();
});

test("flow: blocklisted bank site is never captured (search text dropped)", async () => {
  const h = await harness(["chase.com", "*.chase.com"]);
  await h.set(fg("secure.chase.com"), searchInput("routing number"));
  await h.set(fg("secure.chase.com"), searchInput(""));
  await h.set(null, null);
  assert.deepEqual(h.emitted, []);
  h.stop();
});

test("flow: password field on any site is never captured", async () => {
  const h = await harness([]);
  await h.set(fg("example.com"), { ...editField({ name: "q", isPassword: true }), text: "hunter2" });
  await h.set(null, null);
  assert.deepEqual(h.emitted, []);
  h.stop();
});

test("flow: non-search field is ignored, does not block a later real search", async () => {
  const h = await harness([]);
  await h.set(fg("example.com"), { ...editField({ name: "Email" }), text: "me@x.com" });
  await h.set(fg("duckduckgo.com"), { ...editField({ name: "q" }), text: "vpn comparison" });
  await h.set(null, null);
  assert.deepEqual(
    h.emitted.map((e) => [e.domain, e.text]),
    [["duckduckgo.com", "vpn comparison"]],
  );
  h.stop();
});

test("flow: TWO searches on google without the box clearing between them -> both captured", async () => {
  const h = await harness([]);
  // first search, then it sits in the box while the user reads results
  await h.set(fg("google.com"), searchInput("laptop reviews"));
  await h.set(fg("google.com"), searchInput("laptop reviews"));
  await h.set(fg("google.com"), searchInput("laptop reviews"));
  // second search typed into the same box
  await h.set(fg("google.com"), searchInput("mechanical keyboard"));
  await h.set(fg("google.com"), searchInput("mechanical keyboard"));
  await h.set(null, null); // user clicks a result / leaves
  assert.deepEqual(
    h.emitted.map((e) => e.text),
    ["laptop reviews", "mechanical keyboard"],
  );
  h.stop();
});

test("flow: a failed host read mid-session does NOT lose the pending query", async () => {
  const h = await harness([]);
  await h.set(fg("google.com"), searchInput("annual leave policy"));
  // address bar unreadable for a few ticks (host null) — still a browser
  await h.set({ applicationName: "Google Chrome", windowTitle: "…", host: null, registrableDomain: null, isBrowser: true }, searchInput("annual leave policy"));
  await h.set({ applicationName: "Google Chrome", windowTitle: "…", host: null, registrableDomain: null, isBrowser: true }, null);
  // host recovers, user has moved to a different search
  await h.set(fg("bing.com"), searchInput("carry over days"));
  await h.set(null, null);
  assert.deepEqual(
    h.emitted.map((e) => [e.domain, e.text]),
    [["google.com", "annual leave policy"], ["bing.com", "carry over days"]],
  );
  h.stop();
});

test("flow: a search on a heavy page keeps working even if some ticks can't read the field", async () => {
  const h = await harness([]);
  await h.set(fg("news.example.com"), searchInput("election results"));
  await h.set(fg("news.example.com"), null); // readQueryField miss — hold pending
  await h.set(fg("news.example.com"), null);
  await h.set(fg("news.example.com"), searchInput("")); // box cleared on submit
  await h.set(null, null);
  assert.deepEqual(h.emitted.map((e) => e.text), ["election results"]);
  h.stop();
});
