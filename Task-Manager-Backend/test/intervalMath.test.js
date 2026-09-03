"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const im = require("../utils/intervalMath");

const iv = (start, end) => ({ start, end });

test("normalize sorts, merges overlapping and touching, drops empty", () => {
  // 0-5, 5-8, 7-12 and 10-20 all chain into one 0-20; 30-30 is empty.
  assert.deepEqual(
    im.normalize([iv(10, 20), iv(0, 5), iv(5, 8), iv(7, 12), iv(30, 30)]),
    [iv(0, 20)]
  );
  assert.deepEqual(im.normalize([iv(0, 5), iv(5, 10)]), [iv(0, 10)]);
  assert.deepEqual(im.normalize([iv(0, 5), iv(6, 10)]), [iv(0, 5), iv(6, 10)]);
  assert.deepEqual(im.normalize([iv(5, 5), iv(9, 3)]), []);
});

test("subtract carves holes", () => {
  assert.deepEqual(
    im.subtract([iv(0, 100), iv(200, 300)], [iv(50, 250)]),
    [iv(0, 50), iv(250, 300)]
  );
  assert.deepEqual(im.subtract([iv(0, 10)], []), [iv(0, 10)]);
  assert.deepEqual(im.subtract([], [iv(0, 10)]), []);
  assert.deepEqual(im.subtract([iv(0, 10)], [iv(0, 10)]), []);
});

test("intersect returns overlap only", () => {
  assert.deepEqual(
    im.intersect([iv(0, 100), iv(200, 300)], [iv(50, 250)]),
    [iv(50, 100), iv(200, 250)]
  );
  assert.deepEqual(im.intersect([iv(0, 10)], [iv(20, 30)]), []);
});

test("union merges across lists", () => {
  assert.deepEqual(im.union([iv(0, 100)], [iv(50, 200)], [iv(300, 400)]), [
    iv(0, 200),
    iv(300, 400),
  ]);
});

test("complement inverts within a range", () => {
  assert.deepEqual(im.complement([iv(50, 250)], 0, 300), [iv(0, 50), iv(250, 300)]);
  assert.deepEqual(im.complement([], 0, 100), [iv(0, 100)]);
});

test("totalSeconds rounds", () => {
  assert.equal(im.totalSeconds([iv(0, 5000)]), 5);
  assert.equal(im.totalSeconds([iv(0, 1400)]), 1);
  assert.equal(im.totalSeconds([iv(0, 1600)]), 2);
});

test("partitionByPriority: precedence + exact coverage with fill", () => {
  const segs = im.partitionByPriority(
    0,
    1000,
    [
      { label: "screen_off", intervals: [iv(400, 600)] },
      { label: "idle", intervals: [iv(300, 800)] },
    ],
    { fillLabel: "active" }
  );
  // screen_off wins 400-600; idle keeps 300-400 and 600-800; active fills rest.
  assert.deepEqual(segs, [
    { label: "active", start: 0, end: 300 },
    { label: "idle", start: 300, end: 400 },
    { label: "screen_off", start: 400, end: 600 },
    { label: "idle", start: 600, end: 800 },
    { label: "active", start: 800, end: 1000 },
  ]);
  // covers [0,1000) exactly, no gaps/overlaps
  let cursor = 0;
  for (const s of segs) {
    assert.equal(s.start, cursor);
    cursor = s.end;
  }
  assert.equal(cursor, 1000);
});

test("partitionByPriority without fill leaves gaps out", () => {
  const segs = im.partitionByPriority(0, 100, [
    { label: "x", intervals: [iv(10, 20)] },
  ]);
  assert.deepEqual(segs, [{ label: "x", start: 10, end: 20 }]);
});

test("4-way partition invariant holds for random inputs", () => {
  const rand = (n) => Math.floor(Math.random() * n);
  for (let trial = 0; trial < 200; trial += 1) {
    const total = 1000 + rand(9000);
    const mk = () => {
      const out = [];
      for (let i = 0; i < rand(6); i += 1) {
        const a = rand(total);
        const b = Math.min(total, a + rand(1500));
        if (b > a) out.push(iv(a, b));
      }
      return out;
    };
    const screenOff = mk();
    const untracked = mk();
    const idle = mk();
    const segs = im.partitionByPriority(
      0,
      total,
      [
        { label: "screen_off", intervals: screenOff },
        { label: "untracked", intervals: untracked },
        { label: "idle", intervals: idle },
      ],
      { fillLabel: "active" }
    );
    const sum = segs.reduce((s, seg) => s + (seg.end - seg.start), 0);
    assert.equal(sum, total, `trial ${trial}: partition must cover the whole range`);
    // no overlap
    let cursor = 0;
    for (const s of segs) {
      assert.ok(s.start >= cursor);
      cursor = s.end;
    }
  }
});
