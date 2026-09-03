"use strict";

/**
 * intervalMath — pure set algebra on half-open time intervals [start, end).
 *
 * Every interval is { start, end } with numeric epoch-millisecond bounds and
 * start < end. Inputs may be unsorted, overlapping, or touching; every function
 * returns a NORMALISED list: sorted ascending, non-overlapping, touching
 * intervals merged, zero/negative-length intervals dropped. Functions never
 * mutate their arguments.
 *
 * These are the building blocks for the Phase 2 derivation engine (per-device
 * 4-way partition) and the multi-device wall-clock union merge. No dependencies,
 * exact integer math (no epsilon).
 */

/**
 * Coerce a Date | number | ISO string to epoch milliseconds.
 * @param {Date|number|string} value
 * @returns {number}
 */
function toMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    if (Number.isNaN(t)) throw new TypeError(`intervalMath: unparseable date "${value}"`);
    return t;
  }
  throw new TypeError(`intervalMath: unsupported time value ${typeof value}`);
}

/** @returns {{start:number,end:number}} */
function makeInterval(start, end) {
  return { start: toMs(start), end: toMs(end) };
}

/**
 * Sort, drop empty, merge overlapping/adjacent.
 * @param {Array<{start:*,end:*}>} intervals
 * @returns {Array<{start:number,end:number}>}
 */
function normalize(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) return [];

  const cleaned = intervals
    .map((iv) => ({ start: toMs(iv.start), end: toMs(iv.end) }))
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (cleaned.length === 0) return [];

  const out = [{ ...cleaned[0] }];
  for (let i = 1; i < cleaned.length; i += 1) {
    const prev = out[out.length - 1];
    const cur = cleaned[i];
    if (cur.start <= prev.end) {
      // Overlapping or exactly touching -> extend.
      if (cur.end > prev.end) prev.end = cur.end;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/**
 * Clip every interval to [rangeStart, rangeEnd); intervals fully outside vanish.
 */
function clip(intervals, rangeStart, rangeEnd) {
  const lo = toMs(rangeStart);
  const hi = toMs(rangeEnd);
  if (hi <= lo) return [];
  const clipped = [];
  for (const iv of normalize(intervals)) {
    const start = Math.max(iv.start, lo);
    const end = Math.min(iv.end, hi);
    if (end > start) clipped.push({ start, end });
  }
  return clipped;
}

/**
 * Union of any number of interval lists.
 * @param {...Array} lists
 */
function union(...lists) {
  const all = [];
  for (const list of lists) {
    if (Array.isArray(list)) all.push(...list);
  }
  return normalize(all);
}

/**
 * Intersection of two interval lists (a ∩ b).
 */
function intersect(a, b) {
  const A = normalize(a);
  const B = normalize(b);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const start = Math.max(A[i].start, B[j].start);
    const end = Math.min(A[i].end, B[j].end);
    if (end > start) out.push({ start, end });
    if (A[i].end < B[j].end) i += 1;
    else j += 1;
  }
  return out; // already sorted & disjoint
}

/**
 * Difference of one interval minus a normalised hole list.
 * @returns {Array<{start:number,end:number}>} in ascending order
 */
function subtractOne(cur, holes) {
  const parts = [];
  let cursor = cur.start;
  for (const hole of holes) {
    if (hole.end <= cursor) continue;
    if (hole.start >= cur.end) break;
    if (hole.start > cursor) parts.push({ start: cursor, end: hole.start });
    cursor = Math.max(cursor, hole.end);
    if (cursor >= cur.end) break;
  }
  if (cursor < cur.end) parts.push({ start: cursor, end: cur.end });
  return parts;
}

/**
 * Difference a \ b (parts of `a` not covered by `b`). Result is sorted and
 * disjoint by construction (A is sorted/disjoint; each piece stays within its
 * source interval and pieces are emitted in order).
 */
function subtract(a, b) {
  const A = normalize(a);
  const B = normalize(b);
  if (A.length === 0) return [];
  if (B.length === 0) return A;

  const out = [];
  for (const cur of A) {
    for (const part of subtractOne(cur, B)) out.push(part);
  }
  return out;
}

/**
 * Complement of `intervals` within [rangeStart, rangeEnd).
 */
function complement(intervals, rangeStart, rangeEnd) {
  return subtract([makeInterval(rangeStart, rangeEnd)], intervals);
}

/** Total covered milliseconds. */
function totalMs(intervals) {
  return normalize(intervals).reduce((sum, iv) => sum + (iv.end - iv.start), 0);
}

/** Total covered seconds, rounded to the nearest whole second. */
function totalSeconds(intervals) {
  return Math.round(totalMs(intervals) / 1000);
}

/** True when instant `t` (Date|number|string) falls inside any interval. */
function contains(intervals, t) {
  const ms = toMs(t);
  return normalize(intervals).some((iv) => ms >= iv.start && ms < iv.end);
}

/**
 * Partition [rangeStart, rangeEnd) into labelled, non-overlapping segments using
 * a priority list of buckets. Earlier buckets win where they overlap later ones.
 *
 * @param {Date|number|string} rangeStart
 * @param {Date|number|string} rangeEnd
 * @param {Array<{label:string, intervals:Array}>} buckets  highest priority first
 * @param {{fillLabel?: string}} [opts]  when set, the leftover is emitted with
 *   this label so the result covers the whole range exactly.
 * @returns {Array<{label:string, start:number, end:number}>} sorted by start
 */
function partitionByPriority(rangeStart, rangeEnd, buckets, opts = {}) {
  const lo = toMs(rangeStart);
  const hi = toMs(rangeEnd);
  if (hi <= lo) return [];

  let remaining = [makeInterval(lo, hi)];
  const segments = [];

  for (const bucket of buckets) {
    if (!bucket || !bucket.label) continue;
    const owned = intersect(remaining, clip(bucket.intervals || [], lo, hi));
    for (const iv of owned) {
      segments.push({ label: bucket.label, start: iv.start, end: iv.end });
    }
    remaining = subtract(remaining, owned);
    if (remaining.length === 0) break;
  }

  if (opts.fillLabel && remaining.length > 0) {
    for (const iv of remaining) {
      segments.push({ label: opts.fillLabel, start: iv.start, end: iv.end });
    }
  }

  return segments.sort((a, b) => a.start - b.start);
}

module.exports = {
  toMs,
  makeInterval,
  normalize,
  clip,
  union,
  intersect,
  subtract,
  complement,
  totalMs,
  totalSeconds,
  contains,
  partitionByPriority,
};
