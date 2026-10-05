// Runnable self-check for the pure leave domain logic -- no test framework
// installed (see AGENTS.md / project conventions), so this is a plain
// assert-based script. Run with: node domain/leave.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.

import assert from "node:assert/strict";
import { recordLeave, type Leave, type LeaveRepo } from "./leave.ts";

// --- fake in-memory repo, matching the port shape ---

function makeFakeLeaveRepo(): LeaveRepo & {
  created: { teamMemberId: string; type: string; startDate: Date; endDate: Date }[];
} {
  const created: { teamMemberId: string; type: string; startDate: Date; endDate: Date }[] = [];
  return {
    created,
    async listForTeamMember() {
      return [];
    },
    async listForTeamMembers() {
      return [];
    },
    async create(data) {
      created.push(data);
      const leave: Leave = {
        id: `leave-${created.length}`,
        teamMemberId: data.teamMemberId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
      };
      return leave;
    },
  };
}

async function main() {
  // 1. HAPPY_PATH: valid teamMemberId, valid start/end (end >= start).
  {
    const repo = makeFakeLeaveRepo();
    const result = await recordLeave(repo, {
      teamMemberId: "tm-1",
      type: "planned",
      startDate: new Date("2026-08-18"),
      endDate: new Date("2026-08-20"),
    });
    assert.equal(result.ok, true, "valid input should be accepted");
    assert.ok(result.ok);
    assert.equal(result.data.type, "planned");
    assert.equal(repo.created.length, 1);
  }

  // Same-day (end === start) should also be accepted -- inclusive on both
  // ends.
  {
    const repo = makeFakeLeaveRepo();
    const sameDay = new Date("2026-08-18");
    const result = await recordLeave(repo, {
      teamMemberId: "tm-1",
      type: "planned",
      startDate: sameDay,
      endDate: sameDay,
    });
    assert.equal(result.ok, true, "a single-day leave (end === start) should be accepted");
  }

  // 2. INVALID_DATE_RANGE: endDate before startDate.
  {
    const repo = makeFakeLeaveRepo();
    const result = await recordLeave(repo, {
      teamMemberId: "tm-1",
      type: "planned",
      startDate: new Date("2026-08-20"),
      endDate: new Date("2026-08-18"),
    });
    assert.equal(result.ok, false, "endDate before startDate should be rejected");
    assert.equal(repo.created.length, 0, "no record should be created");
  }

  // 3. INVALID_DATES: missing or unparseable start or end date.
  {
    const repo = makeFakeLeaveRepo();
    const badStart = await recordLeave(repo, {
      teamMemberId: "tm-1",
      type: "planned",
      startDate: new Date("not-a-date"),
      endDate: new Date("2026-08-20"),
    });
    assert.equal(badStart.ok, false, "an invalid start Date should be rejected");

    const badEnd = await recordLeave(repo, {
      teamMemberId: "tm-1",
      type: "planned",
      startDate: new Date("2026-08-18"),
      endDate: new Date("not-a-date"),
    });
    assert.equal(badEnd.ok, false, "an invalid end Date should be rejected");
    assert.equal(repo.created.length, 0);
  }

  // 4. MISSING_TEAM_MEMBER_ID: empty/invalid teamMemberId.
  {
    const repo = makeFakeLeaveRepo();
    const result = await recordLeave(repo, {
      teamMemberId: "",
      type: "planned",
      startDate: new Date("2026-08-18"),
      endDate: new Date("2026-08-20"),
    });
    assert.equal(result.ok, false, "empty teamMemberId should be rejected");
    assert.equal(repo.created.length, 0);
  }

  // 5. Invalid type is rejected -- recordLeave is generic over type, but
  // still only accepts the two known values.
  {
    const repo = makeFakeLeaveRepo();
    const result = await recordLeave(repo, {
      teamMemberId: "tm-1",
      // @ts-expect-error -- deliberately invalid type for the self-check
      type: "vacation",
      startDate: new Date("2026-08-18"),
      endDate: new Date("2026-08-20"),
    });
    assert.equal(result.ok, false, "an unknown type should be rejected");
    assert.equal(repo.created.length, 0);
  }

  // 6. emergency type is accepted -- proves recordLeave is generic over
  // type even though this story's UI only ever sends "planned".
  {
    const repo = makeFakeLeaveRepo();
    const result = await recordLeave(repo, {
      teamMemberId: "tm-1",
      type: "emergency",
      startDate: new Date("2026-08-18"),
      endDate: new Date("2026-08-20"),
    });
    assert.equal(result.ok, true, "type: 'emergency' should be accepted by the domain function");
  }

  console.log("leave.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("leave.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
