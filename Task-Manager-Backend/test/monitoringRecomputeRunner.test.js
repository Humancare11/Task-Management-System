"use strict";

/**
 * Runner claim/finish semantics with an in-memory queue model. The subtle bit:
 * an event that arrives mid-recompute flips the row back to 'pending', and the
 * finish step must NOT delete it (guard: destroy only where status='running').
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

// --- in-memory monitoring_recompute_queue ---
let queue = [];
let nextId = 1;

function matches(row, where) {
  for (const [k, v] of Object.entries(where || {})) {
    if (v && typeof v === "object") {
      for (const sym of Object.getOwnPropertySymbols(v)) {
        // only Op.lte used in claimOne
        if (row[k] > v[sym]) return false;
      }
    } else if (row[k] !== v) {
      return false;
    }
  }
  return true;
}

const QueueModel = {
  async findOne({ where, order }) {
    let rows = queue.filter((r) => matches(r, where));
    if (order) {
      rows = [...rows].sort((a, b) => (a[order[0][0]] < b[order[0][0]] ? -1 : 1));
    }
    return rows[0] ? { ...rows[0] } : null;
  },
  async update(vals, { where }) {
    let n = 0;
    for (const r of queue) {
      if (matches(r, where)) {
        Object.assign(r, vals);
        n += 1;
      }
    }
    return [n];
  },
  async destroy({ where }) {
    const before = queue.length;
    queue = queue.filter((r) => !matches(r, where));
    return before - queue.length;
  },
  async findAll() {
    return [];
  },
};

const realLoad = Module._load;
let recomputeCalls = [];
let recomputeImpl = async () => {};

Module._load = function (request, parent, isMain) {
  if (request === "../models") {
    return {
      MonitoringRecomputeQueue: QueueModel,
      MonitoringEvent: { findAll: async () => [] },
      MonitoringPcSession: { findAll: async () => [] },
    };
  }
  if (request === "./monitoringDerivation") {
    return {
      recomputeDay: async (agentId, localDate) => {
        recomputeCalls.push([agentId, localDate]);
        return recomputeImpl(agentId, localDate);
      },
    };
  }
  if (request === "../utils/monitoringRecompute") {
    return { enqueueRecompute: async () => {} };
  }
  if (request === "../utils/monitoringTime") {
    return { serverLocalDate: () => "2026-09-03" };
  }
  return realLoad(request, parent, isMain);
};

const runner = require("../services/monitoringRecomputeRunner");
Module._load = realLoad;

function resetQueue(rows) {
  queue = rows.map((r) => ({
    id: nextId++,
    status: "pending",
    attempts: 0,
    not_before: 0,
    last_error: null,
    ...r,
  }));
  recomputeCalls = [];
  recomputeImpl = async () => {};
}

test("drainOnce processes a due row and removes it on success", async () => {
  resetQueue([{ agent_id: 1, local_date: "2026-09-03" }]);
  await runner.drainOnce();
  assert.deepEqual(recomputeCalls, [[1, "2026-09-03"]]);
  assert.equal(queue.length, 0);
});

test("a future not_before row is left alone", async () => {
  resetQueue([{ agent_id: 2, local_date: "2026-09-03", not_before: Date.now() + 3600_000 }]);
  await runner.drainOnce();
  assert.equal(recomputeCalls.length, 0);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].status, "pending");
});

test("a row re-enqueued mid-recompute is NOT deleted on finish", async () => {
  resetQueue([{ agent_id: 3, local_date: "2026-09-03" }]);
  recomputeImpl = async () => {
    // simulate an event arriving during derivation: enqueueRecompute upserts
    // the same key back to pending.
    queue[0].status = "pending";
    queue[0].not_before = Date.now() + 45_000;
  };
  await runner.drainOnce();
  assert.equal(queue.length, 1, "row survives");
  assert.equal(queue[0].status, "pending");
});

test("failure retries with backoff, then goes to error after MAX_ATTEMPTS", async () => {
  resetQueue([{ agent_id: 4, local_date: "2026-09-03", attempts: 4 }]);
  recomputeImpl = async () => {
    throw new Error("boom");
  };
  await runner.drainOnce();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].status, "error");
  assert.match(queue[0].last_error, /boom/);
});

test("failure below MAX_ATTEMPTS re-queues as pending with a delay", async () => {
  resetQueue([{ agent_id: 5, local_date: "2026-09-03", attempts: 0 }]);
  recomputeImpl = async () => {
    throw new Error("transient");
  };
  const t0 = Date.now();
  await runner.drainOnce();
  assert.equal(queue[0].status, "pending");
  assert.ok(queue[0].not_before > t0, "not_before pushed into the future");
});
