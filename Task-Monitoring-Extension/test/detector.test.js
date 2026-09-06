"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    classifyCommit,
    looksLikeSearchField,
    urlHasSearchParam,
    normalizeHost,
    registrableDomain,
} = require("../src/detector");

const input = (over = {}) => ({
    tag: "input",
    type: "text",
    role: "",
    name: "",
    id: "",
    ariaLabel: "",
    placeholder: "",
    value: "",
    isContentEditable: false,
    inSearchRole: false,
    formHasSearchParam: false,
    ...over,
});

// --- host helpers -------------------------------------------------------

test("normalizeHost / registrableDomain", () => {
    assert.equal(normalizeHost("https://www.google.com/search?q=x"), "google.com");
    assert.equal(normalizeHost("https://gemini.google.com/app"), "gemini.google.com");
    assert.equal(normalizeHost("chrome://settings"), null);
    assert.equal(registrableDomain("gemini.google.com"), "google.com");
    assert.equal(registrableDomain("news.bbc.co.uk"), "bbc.co.uk");
});

test("urlHasSearchParam picks up known params only", () => {
    assert.equal(urlHasSearchParam("https://x.com/s?q=hello%20world"), "hello world");
    assert.equal(urlHasSearchParam("https://x.com/results?search_query=lofi"), "lofi");
    assert.equal(urlHasSearchParam("https://x.com/s?k=usb+c+cable"), "usb c cable");
    assert.equal(urlHasSearchParam("https://x.com/page?ref=nav"), null);
    assert.equal(urlHasSearchParam("not a url"), null);
});

// --- field classification ---------------------------------------------

test("looksLikeSearchField: type=search / role / tokens / form param", () => {
    assert.equal(looksLikeSearchField(input({ type: "search" })), true);
    assert.equal(looksLikeSearchField(input({ role: "searchbox" })), true);
    assert.equal(looksLikeSearchField(input({ inSearchRole: true })), true);
    assert.equal(looksLikeSearchField(input({ name: "q" })), true);
    assert.equal(looksLikeSearchField(input({ name: "search_query" })), true);
    assert.equal(looksLikeSearchField(input({ ariaLabel: "Search Amazon" })), true);
    assert.equal(looksLikeSearchField(input({ placeholder: "Search YouTube" })), true);
    assert.equal(looksLikeSearchField(input({ formHasSearchParam: true })), true);
    assert.equal(
        looksLikeSearchField(input({ name: "email" }), "https://x.com/signup"),
        false,
    );
    assert.equal(looksLikeSearchField(input({ type: "password", name: "q" })), false);
});

test("classifyCommit: form submit of a search field -> search + host", () => {
    const r = classifyCommit({
        type: "submit",
        pageUrl: "https://www.amazon.com/",
        navUrl: "https://www.amazon.com/s?k=mechanical+keyboard",
        field: input({ name: "field-keywords", ariaLabel: "Search Amazon", value: "mechanical keyboard" }),
    });
    assert.deepEqual(r, {
        kind: "search",
        text: "mechanical keyboard",
        host: "amazon.com",
        registrableDomain: "amazon.com",
    });
});

test("classifyCommit: SPA search via URL change (no field) -> search", () => {
    const r = classifyCommit({
        type: "url-search",
        pageUrl: "https://www.youtube.com/results?search_query=lofi+hip+hop",
        navUrl: "https://www.youtube.com/results?search_query=lofi+hip+hop",
    });
    assert.equal(r.kind, "search");
    assert.equal(r.text, "lofi hip hop");
    assert.equal(r.host, "youtube.com");
});

test("classifyCommit: Enter in a plain search input on an arbitrary site", () => {
    const r = classifyCommit({
        type: "enter",
        pageUrl: "https://forum.example.com/",
        field: input({ role: "searchbox", value: "how to reset password" }),
    });
    assert.deepEqual(r, {
        kind: "search",
        text: "how to reset password",
        host: "forum.example.com",
        registrableDomain: "example.com",
    });
});

test("classifyCommit: AI-assistant prompt on chatgpt.com", () => {
    const r = classifyCommit({
        type: "enter",
        pageUrl: "https://chatgpt.com/c/abc",
        field: { tag: "textarea", value: "explain the CAP theorem", isContentEditable: false },
    });
    assert.equal(r.kind, "prompt");
    assert.equal(r.text, "explain the CAP theorem");
    assert.equal(r.host, "chatgpt.com");
});

test("classifyCommit: AI-assistant prompt from a contenteditable composer", () => {
    const r = classifyCommit({
        type: "enter",
        pageUrl: "https://claude.ai/chat/1",
        field: { tag: "div", isContentEditable: true, value: "  write a haiku about tests  " },
    });
    assert.equal(r.kind, "prompt");
    assert.equal(r.text, "write a haiku about tests");
});

test("classifyCommit: non-search field is ignored", () => {
    assert.equal(
        classifyCommit({
            type: "submit",
            pageUrl: "https://example.com/contact",
            navUrl: "https://example.com/contact",
            field: input({ name: "message", value: "hello there" }),
        }),
        null,
    );
});

test("classifyCommit: empty / whitespace value is ignored", () => {
    assert.equal(
        classifyCommit({
            type: "enter",
            pageUrl: "https://x.com/",
            field: input({ role: "searchbox", value: "   " }),
        }),
        null,
    );
});

test("classifyCommit: an internal / non-web page url -> null (no host)", () => {
    assert.equal(
        classifyCommit({
            type: "enter",
            pageUrl: "chrome://newtab",
            field: input({ role: "searchbox", value: "anything" }),
        }),
        null,
    );
});

test("classifyCommit: very long text is capped", () => {
    const long = "x".repeat(5000);
    const r = classifyCommit({
        type: "enter",
        pageUrl: "https://x.com/",
        field: input({ role: "searchbox", value: long }),
    });
    assert.equal(r.text.length, 2000);
});
