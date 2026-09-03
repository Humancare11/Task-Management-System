"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { EventQueue } = require("../src/storage/eventQueue");
const { makeEnvelope } = require("../src/monitoring/events");

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-test-"));
  return path.join(dir, "events.jsonl");
}

const ev = (type = "heartbeat") => makeEnvelope({ type, payload: {}, seq: 1 });

test("append + peek + size", () => {
  const f = tmpFile();
  const q = new EventQueue({ filePath: f });
  const a = ev("agent_start");
  const b = ev("app_focus");
  q.append(a);
  q.append(b);
  assert.equal(q.size(), 2);
  assert.deepEqual(
    q.peek(10).map((e) => e.client_event_id),
    [a.client_event_id, b.client_event_id]
  );
});

test("commit removes acked events and compacts atomically", () => {
  const f = tmpFile();
  const q = new EventQueue({ filePath: f });
  const a = ev();
  const b = ev();
  const c = ev();
  q.appendMany([a, b, c]);
  const removed = q.commit([a.client_event_id, c.client_event_id]);
  assert.equal(removed, 2);
  assert.deepEqual(
    new EventQueue({ filePath: f }).peek().map((e) => e.client_event_id),
    [b.client_event_id]
  );
  // file ends with a newline after compaction
  assert.equal(fs.readFileSync(f, "utf8").endsWith("\n"), true);
});

test("torn final line (power cut mid-append) is discarded on recovery", () => {
  const f = tmpFile();
  const q = new EventQueue({ filePath: f });
  const a = ev();
  q.append(a);
  fs.appendFileSync(f, '{"client_event_id":"x","type":"heart'); // no newline, truncated
  const q2 = new EventQueue({ filePath: f });
  assert.equal(q2.size(), 1);
  assert.equal(q2.peek()[0].client_event_id, a.client_event_id);
  assert.equal(fs.readFileSync(f, "utf8").endsWith("\n"), true);
});

test("mid-file corruption is quarantined and good lines salvaged", () => {
  const f = tmpFile();
  const good = ev();
  fs.writeFileSync(f, "THIS IS NOT JSON\n" + JSON.stringify(good) + "\n");
  const q = new EventQueue({ filePath: f });
  assert.equal(q.size(), 1);
  assert.equal(q.peek()[0].client_event_id, good.client_event_id);
  const siblings = fs.readdirSync(path.dirname(f));
  assert.equal(siblings.some((n) => n.includes(".corrupt-")), true);
});

test("maxEvents cap drops oldest on recovery", () => {
  const f = tmpFile();
  const q = new EventQueue({ filePath: f, maxEvents: 3 });
  for (let i = 0; i < 10; i += 1) q.append(ev());
  const reopened = new EventQueue({ filePath: f, maxEvents: 3 });
  assert.equal(reopened.size(), 3);
});

test("append rejects an event without a client_event_id", () => {
  const q = new EventQueue({ filePath: tmpFile() });
  assert.throws(() => q.append({ type: "heartbeat" }), /client_event_id/);
});
