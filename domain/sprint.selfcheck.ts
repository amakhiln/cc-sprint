// Runnable self-check for the pure sprint domain logic -- no test framework
// installed (see AGENTS.md / project conventions), so this is a plain
// assert-based script. Run with: node domain/sprint.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.

import assert from "node:assert/strict";
import { createSprint, closeSprint, type Sprint, type SprintRepo } from "./sprint.ts";

// --- fake in-memory repo, matching the port shape ---

function makeFakeSprintRepo(active: Sprint | null = null): SprintRepo & {
  created: { startDate: Date; endDate: Date }[];
} {
  const created: { startDate: Date; endDate: Date }[] = [];
  return {
    created,
    async findActive() {
      return active;
    },
    async create(data) {
      created.push(data);
      return {
        id: `sprint-${created.length}`,
        startDate: data.startDate,
        endDate: data.endDate,
        status: "active",
        snapshotCapacityHours: null,
        snapshotAllocationBreakdown: null,
        snapshotActualVelocityHours: null,
      };
    },
    async close() {
      throw new Error("not used by these tests");
    },
    async listClosed() {
      throw new Error("not used by these tests");
    },
  };
}

// A fake repo for closeSprint tests -- tracks the exact `close` call
// arguments and simulates the atomic active-only guard (null once "closed").
function makeFakeCloseRepo(sprintId: string): SprintRepo & {
  closeCalls: { id: string; data: Parameters<SprintRepo["close"]>[1] }[];
} {
  let closed = false;
  const closeCalls: { id: string; data: Parameters<SprintRepo["close"]>[1] }[] = [];
  return {
    closeCalls,
    async findActive() {
      // Mirrors the real repo: the Sprint is "active" (findable) until this
      // fake's own close() call flips it -- matches closeSprint's new
      // repo.findActive() pre-check.
      if (closed) return null;
      return {
        id: sprintId,
        startDate: new Date("2026-08-17"),
        endDate: new Date("2026-08-28"),
        status: "active",
        snapshotCapacityHours: null,
        snapshotAllocationBreakdown: null,
        snapshotActualVelocityHours: null,
      };
    },
    async create() {
      throw new Error("not used by these tests");
    },
    async close(id, data) {
      closeCalls.push({ id, data });
      if (closed || id !== sprintId) {
        return null;
      }
      closed = true;
      return {
        id: sprintId,
        startDate: new Date("2026-08-17"),
        endDate: new Date("2026-08-28"),
        status: "closed",
        snapshotCapacityHours: data.snapshotCapacityHours,
        snapshotAllocationBreakdown: data.snapshotAllocationBreakdown,
        snapshotActualVelocityHours: data.snapshotActualVelocityHours,
      };
    },
    async listClosed() {
      throw new Error("not used by these tests");
    },
  };
}

// A repo whose create() throws a real-Prisma-shaped P2002 error, to verify
// the duck-typed isUniqueConstraintViolation check without importing
// @prisma/client into this framework-free domain file.
function makeP2002ThrowingRepo(): SprintRepo {
  return {
    async findActive() {
      return null;
    },
    async create() {
      const error = new Error("Unique constraint failed") as Error & { code: string };
      error.code = "P2002";
      throw error;
    },
    async close() {
      throw new Error("not used by these tests");
    },
    async listClosed() {
      throw new Error("not used by these tests");
    },
  };
}

async function main() {
  // 1. A P2002-shaped throw from repo.create() is caught and turned into the
  // "already active" rejection rather than propagating.
  {
    const repo = makeP2002ThrowingRepo();
    const result = await createSprint(repo, { startDate: new Date("2026-08-18") });
    assert.equal(result.ok, false, "P2002 from create() should be rejected, not thrown");
    assert.ok(!result.ok);
    assert.match(result.error, /already active/, "should return the already-active rejection");
  }

  // 2. Inclusive endDate arithmetic for known inputs.
  {
    const repo = makeFakeSprintRepo();
    const result = await createSprint(repo, {
      startDate: new Date("2026-08-18"),
      lengthDays: 14,
    });
    assert.equal(result.ok, true, "valid input should be accepted");
    assert.ok(result.ok);
    assert.equal(result.data.endDate.getUTCFullYear(), 2026);
    assert.equal(result.data.endDate.getUTCMonth(), 7, "August is month index 7");
    assert.equal(result.data.endDate.getUTCDate(), 31, "14 days from Aug 18 ends Aug 31 (inclusive)");
  }
  {
    const repo = makeFakeSprintRepo();
    const startDate = new Date("2026-08-18");
    const result = await createSprint(repo, { startDate, lengthDays: 1 });
    assert.equal(result.ok, true, "lengthDays: 1 should be accepted");
    assert.ok(result.ok);
    assert.equal(
      result.data.endDate.getTime(),
      startDate.getTime(),
      "lengthDays: 1 should make endDate equal startDate",
    );
  }

  // 3. REJECT_WHEN_ACTIVE: findActive() returning a Sprint rejects the
  // pre-check path (not the unique-violation catch path).
  {
    const activeSprint: Sprint = {
      id: "sprint-existing",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-14"),
      status: "active",
      snapshotCapacityHours: null,
      snapshotAllocationBreakdown: null,
      snapshotActualVelocityHours: null,
    };
    const repo = makeFakeSprintRepo(activeSprint);
    const result = await createSprint(repo, { startDate: new Date("2026-08-18") });
    assert.equal(result.ok, false, "should reject when a Sprint is already active");
    assert.equal(repo.created.length, 0, "no Sprint should be created when one is active");
  }

  // 4. INVALID_START_DATE: missing/unparseable start date.
  {
    const repo = makeFakeSprintRepo();
    const badDate = await createSprint(repo, { startDate: new Date("not-a-date") });
    assert.equal(badDate.ok, false, "an invalid Date should be rejected");
    assert.equal(repo.created.length, 0);
  }

  // 5. INVALID_LENGTH: non-integer, zero, negative, and the new 365-day
  // ceiling.
  {
    const repo = makeFakeSprintRepo();
    const startDate = new Date("2026-08-18");

    const nonInt = await createSprint(repo, { startDate, lengthDays: 3.5 });
    assert.equal(nonInt.ok, false, "non-integer lengthDays should be rejected");

    const zero = await createSprint(repo, { startDate, lengthDays: 0 });
    assert.equal(zero.ok, false, "zero lengthDays should be rejected");

    const negative = await createSprint(repo, { startDate, lengthDays: -5 });
    assert.equal(negative.ok, false, "negative lengthDays should be rejected");

    const atCeiling = await createSprint(repo, { startDate, lengthDays: 365 });
    assert.equal(atCeiling.ok, true, "365 days should be accepted (at the ceiling)");

    const overCeiling = await createSprint(repo, { startDate, lengthDays: 366 });
    assert.equal(overCeiling.ok, false, "366 days should be rejected (over the ceiling)");

    const wayOver = await createSprint(repo, { startDate, lengthDays: 100000 });
    assert.equal(wayOver.ok, false, "an absurd lengthDays like 100000 should be rejected");
    assert.ok(!wayOver.ok);
    assert.match(wayOver.error, /365/, "rejection message should mention the ceiling");

    assert.equal(repo.created.length, 1, "only the at-ceiling 365-day Sprint should have been created");
  }

  // 6. CLOSE_HAPPY_PATH -- confirmed hours sum correctly into
  // snapshotActualVelocityHours, and the repo receives the exact per-issue
  // loggedHours entries (the edited values, per CONFIRM_EDITED_VALUE).
  {
    const repo = makeFakeCloseRepo("sprint-1");
    const confirmedHoursByIssueId = new Map([
      ["bi-1", 5],
      ["bi-2", 0],
    ]);
    const result = await closeSprint(repo, {
      sprintId: "sprint-1",
      confirmedHoursByIssueId,
      snapshotCapacityHours: 40,
      snapshotAllocationBreakdown: [{ categoryId: "cat-dev", hours: 40 }],
    });
    assert.equal(result.ok, true, "a valid close should succeed");
    assert.ok(result.ok);
    assert.equal(result.data.status, "closed");
    assert.equal(result.data.snapshotActualVelocityHours, 5, "Actual Velocity should sum the confirmed hours (5 + 0)");
    assert.equal(repo.closeCalls.length, 1);
    assert.deepEqual(
      repo.closeCalls[0].data.issueLoggedHours.sort((a, b) => a.issueId.localeCompare(b.issueId)),
      [
        { issueId: "bi-1", loggedHours: 5 },
        { issueId: "bi-2", loggedHours: 0 },
      ],
      "the repo should receive the exact confirmed per-issue hours",
    );
  }

  // 7. CLOSE_NO_ASSIGNED_ISSUES -- an empty confirmedHoursByIssueId Map is
  // valid and sums to 0, not rejected.
  {
    const repo = makeFakeCloseRepo("sprint-1");
    const result = await closeSprint(repo, {
      sprintId: "sprint-1",
      confirmedHoursByIssueId: new Map(),
      snapshotCapacityHours: 40,
      snapshotAllocationBreakdown: [],
    });
    assert.equal(result.ok, true, "closing with zero assigned issues should succeed");
    assert.ok(result.ok);
    assert.equal(result.data.snapshotActualVelocityHours, 0);
  }

  // 8. CLOSE_DOUBLE_CLOSE_RACE -- a second close on the same Sprint is
  // rejected, not silently overwritten (the fake repo's `closed` flag models
  // the real atomic status:'active' guard returning null).
  {
    const repo = makeFakeCloseRepo("sprint-1");
    const input = {
      sprintId: "sprint-1",
      confirmedHoursByIssueId: new Map([["bi-1", 5]]),
      snapshotCapacityHours: 40,
      snapshotAllocationBreakdown: [],
    };
    const first = await closeSprint(repo, input);
    assert.equal(first.ok, true, "the first close should succeed");
    const second = await closeSprint(repo, input);
    assert.equal(second.ok, false, "a second close on an already-closed Sprint should be rejected");
    assert.ok(!second.ok);
    assert.equal(second.error, "This Sprint is no longer active.");
  }

  // 9. CLOSE_INVALID_HOURS -- a negative or non-finite confirmed hours value
  // is rejected before the repo is ever called.
  {
    const repo = makeFakeCloseRepo("sprint-1");
    const negative = await closeSprint(repo, {
      sprintId: "sprint-1",
      confirmedHoursByIssueId: new Map([["bi-1", -1]]),
      snapshotCapacityHours: 40,
      snapshotAllocationBreakdown: [],
    });
    assert.equal(negative.ok, false, "negative logged hours should be rejected");
    const notFinite = await closeSprint(repo, {
      sprintId: "sprint-1",
      confirmedHoursByIssueId: new Map([["bi-1", NaN]]),
      snapshotCapacityHours: 40,
      snapshotAllocationBreakdown: [],
    });
    assert.equal(notFinite.ok, false, "NaN logged hours should be rejected");
    assert.equal(repo.closeCalls.length, 0, "the repo should never be called for rejected input");
  }

  console.log("sprint.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("sprint.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
