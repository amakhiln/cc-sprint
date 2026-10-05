// Runnable self-check for the pure backlog-issue domain logic -- no test
// framework installed (see AGENTS.md / project conventions), so this is a
// plain assert-based script. Run with: node domain/backlog-issue.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.

import assert from "node:assert/strict";
import {
  pullBacklogIssue,
  assignBacklogIssue,
  sumEstimateHours,
  sumAssignedHoursByMember,
  type BacklogIssue,
  type BacklogIssueRepo,
} from "./backlog-issue.ts";
import type { Sprint, SprintRepo } from "./sprint.ts";

function makeFakeRepo(): BacklogIssueRepo & { rows: BacklogIssue[] } {
  const rows: BacklogIssue[] = [];
  let nextId = 1;
  return {
    get rows() {
      return rows;
    },
    async create(data) {
      // Mirrors the real DB's (sprintId, youtrackIssueId) unique index --
      // the domain layer has no app-level pre-check of its own, only this
      // constraint (see pullBacklogIssue's P2002 handling).
      const duplicate = rows.some(
        (row) => row.sprintId === data.sprintId && row.youtrackIssueId === data.youtrackIssueId,
      );
      if (duplicate) {
        const error = new Error("Unique constraint failed") as Error & { code: string };
        error.code = "P2002";
        throw error;
      }
      const row: BacklogIssue = {
        id: `bi-${nextId++}`,
        youtrackIssueId: data.youtrackIssueId,
        sprintId: data.sprintId,
        title: data.title,
        assigneeId: null,
        estimateHours: data.estimateHours,
        loggedHours: 0,
        loggedHoursPulledAt: null,
      };
      rows.push(row);
      return row;
    },
    async listForSprint(sprintId) {
      return rows.filter((row) => row.sprintId === sprintId);
    },
    async updateAssignee(id, sprintId, assigneeId) {
      // Mirrors the real repo's atomic "belongs to this Sprint" guard, plus
      // a simulated FK violation for a sentinel id (the real DB would throw
      // P2003 for an assigneeId that doesn't reference a real Team Member).
      if (assigneeId === "no-such-team-member") {
        const error = new Error("Foreign key constraint failed") as Error & { code: string };
        error.code = "P2003";
        throw error;
      }
      const row = rows.find((candidate) => candidate.id === id && candidate.sprintId === sprintId);
      if (!row) return null;
      row.assigneeId = assigneeId;
      return row;
    },
  };
}

function makeFakeSprintRepo(activeSprintId: string | null): Pick<SprintRepo, "findActive"> {
  return {
    async findActive() {
      if (!activeSprintId) return null;
      return {
        id: activeSprintId,
        startDate: new Date("2026-08-17"),
        endDate: new Date("2026-08-28"),
        status: "active",
        snapshotCapacityHours: null,
        snapshotAllocationBreakdown: null,
        snapshotActualVelocityHours: null,
      } satisfies Sprint;
    },
  };
}

async function main() {
  const validInput = {
    sprintId: "sprint-1",
    youtrackIssueId: "PROJ-1",
    title: "Fix login bug",
    estimateHours: 4,
  };
  const activeSprint1 = makeFakeSprintRepo("sprint-1");

  // ESTIMATE_FROM_YOUTRACK -- a valid pull persists exactly the given
  // estimate, with assigneeId null (Story 3.4's job, never set here).
  {
    const repo = makeFakeRepo();
    const result = await pullBacklogIssue(repo, activeSprint1, validInput);
    assert.equal(result.ok, true, "a valid pull should succeed");
    assert.ok(result.ok);
    assert.equal(result.data.estimateHours, 4);
    assert.equal(result.data.assigneeId, null, "assigneeId should be null -- Story 3.3 never sets it");
    assert.equal(result.data.loggedHours, 0, "loggedHours should default to 0");
    assert.equal(result.data.loggedHoursPulledAt, null, "loggedHoursPulledAt should be null until Sprint close");
  }

  // ESTIMATE_MISSING -- a non-positive or non-finite estimate is rejected,
  // matching the "prompted to enter manually" AC's required-field contract.
  {
    const repo = makeFakeRepo();
    const zero = await pullBacklogIssue(repo, activeSprint1, { ...validInput, estimateHours: 0 });
    assert.equal(zero.ok, false, "a zero estimate should be rejected");
    const negative = await pullBacklogIssue(repo, activeSprint1, { ...validInput, estimateHours: -1 });
    assert.equal(negative.ok, false, "a negative estimate should be rejected");
    const notANumber = await pullBacklogIssue(repo, activeSprint1, { ...validInput, estimateHours: NaN });
    assert.equal(notANumber.ok, false, "NaN should be rejected");
    assert.equal(repo.rows.length, 0, "no rows should be persisted for any rejected estimate");
  }

  // BLANK_FIELD -- sprintId/youtrackIssueId/title required.
  {
    const repo = makeFakeRepo();
    const blankSprint = await pullBacklogIssue(repo, activeSprint1, { ...validInput, sprintId: "  " });
    assert.equal(blankSprint.ok, false, "blank sprintId should be rejected");
    const blankIssue = await pullBacklogIssue(repo, activeSprint1, { ...validInput, youtrackIssueId: "" });
    assert.equal(blankIssue.ok, false, "blank youtrackIssueId should be rejected");
    const blankTitle = await pullBacklogIssue(repo, activeSprint1, { ...validInput, title: "   " });
    assert.equal(blankTitle.ok, false, "blank title should be rejected");
    assert.equal(repo.rows.length, 0, "no rows should be persisted for any rejected field");
  }

  // SPRINT_NOT_ACTIVE -- pulling into a Sprint that isn't the currently
  // active one (closed, or none active at all) is rejected before the repo
  // is ever called.
  {
    const repo = makeFakeRepo();
    const noActiveSprint = makeFakeSprintRepo(null);
    const rejectedNoActive = await pullBacklogIssue(repo, noActiveSprint, validInput);
    assert.equal(rejectedNoActive.ok, false, "pulling with no active Sprint should be rejected");
    assert.ok(!rejectedNoActive.ok);
    assert.equal(rejectedNoActive.error, "This Sprint is no longer active.");

    const differentActiveSprint = makeFakeSprintRepo("sprint-2");
    const rejectedMismatch = await pullBacklogIssue(repo, differentActiveSprint, validInput);
    assert.equal(rejectedMismatch.ok, false, "pulling into a non-active Sprint should be rejected");
    assert.equal(repo.rows.length, 0, "no rows should be persisted for either rejection");
  }

  // DUPLICATE_PULL_SAME_SPRINT -- the same youtrackIssueId pulled into the
  // same Sprint twice is rejected on the second attempt; the first row is
  // untouched.
  {
    const repo = makeFakeRepo();
    const first = await pullBacklogIssue(repo, activeSprint1, validInput);
    assert.equal(first.ok, true, "the first pull should succeed");
    const second = await pullBacklogIssue(repo, activeSprint1, validInput);
    assert.equal(second.ok, false, "a duplicate pull into the same Sprint should be rejected");
    assert.ok(!second.ok);
    assert.equal(second.error, "This issue has already been pulled into this Sprint.");
    assert.equal(repo.rows.length, 1, "only the first pull's row should exist");
  }

  // DUPLICATE_PULL_DIFFERENT_SPRINT -- the same youtrackIssueId pulled into
  // two different Sprints (each active in turn, matching AD-6's single-
  // active-Sprint rule) creates two independent rows, neither overwritten.
  {
    const repo = makeFakeRepo();
    const first = await pullBacklogIssue(repo, activeSprint1, { ...validInput, sprintId: "sprint-1" });
    const activeSprint2 = makeFakeSprintRepo("sprint-2");
    const second = await pullBacklogIssue(repo, activeSprint2, { ...validInput, sprintId: "sprint-2" });
    assert.equal(first.ok, true, "the first Sprint's pull should succeed");
    assert.equal(second.ok, true, "a different Sprint's pull of the same issue should also succeed");
    assert.equal(repo.rows.length, 2, "two independent rows should exist, one per Sprint");
    const forSprint1 = await repo.listForSprint("sprint-1");
    const forSprint2 = await repo.listForSprint("sprint-2");
    assert.equal(forSprint1.length, 1);
    assert.equal(forSprint2.length, 1);
    assert.notEqual(forSprint1[0].id, forSprint2[0].id, "the two Sprints' rows should be distinct records");
  }

  // ASSIGN -- a pulled issue's null assigneeId is set to a real Team Member.
  {
    const repo = makeFakeRepo();
    const pulled = await pullBacklogIssue(repo, activeSprint1, validInput);
    assert.ok(pulled.ok);
    const assigned = await assignBacklogIssue(repo, activeSprint1, {
      issueId: pulled.data.id,
      assigneeId: "tm-ada",
    });
    assert.equal(assigned.ok, true, "assigning a pulled issue should succeed");
    assert.ok(assigned.ok);
    assert.equal(assigned.data.assigneeId, "tm-ada");
  }

  // REASSIGN -- the same function reassigns an already-assigned issue; the
  // previous assignee no longer has it (there's only ever one assigneeId).
  {
    const repo = makeFakeRepo();
    const pulled = await pullBacklogIssue(repo, activeSprint1, validInput);
    assert.ok(pulled.ok);
    await assignBacklogIssue(repo, activeSprint1, { issueId: pulled.data.id, assigneeId: "tm-ada" });
    const reassigned = await assignBacklogIssue(repo, activeSprint1, {
      issueId: pulled.data.id,
      assigneeId: "tm-grace",
    });
    assert.equal(reassigned.ok, true, "reassigning should succeed");
    assert.ok(reassigned.ok);
    assert.equal(reassigned.data.assigneeId, "tm-grace", "the new assignee should replace the old one");
  }

  // UNASSIGN -- choosing "Unassigned" (assigneeId: null) clears an existing
  // assignment.
  {
    const repo = makeFakeRepo();
    const pulled = await pullBacklogIssue(repo, activeSprint1, validInput);
    assert.ok(pulled.ok);
    await assignBacklogIssue(repo, activeSprint1, { issueId: pulled.data.id, assigneeId: "tm-ada" });
    const unassigned = await assignBacklogIssue(repo, activeSprint1, {
      issueId: pulled.data.id,
      assigneeId: null,
    });
    assert.equal(unassigned.ok, true, "unassigning should succeed");
    assert.ok(unassigned.ok);
    assert.equal(unassigned.data.assigneeId, null);
  }

  // SPRINT_NO_LONGER_ACTIVE (assignment) -- no active Sprint, or the issue
  // belongs to a different Sprint than the currently active one, is rejected
  // before/without any write.
  {
    const repo = makeFakeRepo();
    const pulled = await pullBacklogIssue(repo, activeSprint1, validInput);
    assert.ok(pulled.ok);

    const noActiveSprint = makeFakeSprintRepo(null);
    const rejectedNoActive = await assignBacklogIssue(repo, noActiveSprint, {
      issueId: pulled.data.id,
      assigneeId: "tm-ada",
    });
    assert.equal(rejectedNoActive.ok, false, "assigning with no active Sprint should be rejected");
    assert.ok(!rejectedNoActive.ok);
    assert.equal(rejectedNoActive.error, "This Sprint is no longer active.");

    const differentActiveSprint = makeFakeSprintRepo("sprint-2");
    const rejectedMismatch = await assignBacklogIssue(repo, differentActiveSprint, {
      issueId: pulled.data.id,
      assigneeId: "tm-ada",
    });
    assert.equal(rejectedMismatch.ok, false, "assigning an issue outside the active Sprint should be rejected");
    assert.ok(!rejectedMismatch.ok);
    assert.equal(rejectedMismatch.error, "Issue not found in the active Sprint.");

    const stillUnassigned = await repo.listForSprint("sprint-1");
    assert.equal(stillUnassigned[0].assigneeId, null, "neither rejection should have written anything");
  }

  // Assigning an unknown issue id is rejected, not thrown.
  {
    const repo = makeFakeRepo();
    const result = await assignBacklogIssue(repo, activeSprint1, { issueId: "no-such-issue", assigneeId: "tm-ada" });
    assert.equal(result.ok, false, "an unknown issue id should be rejected");
    assert.ok(!result.ok);
    assert.equal(result.error, "Issue not found in the active Sprint.");
  }

  // ASSIGNEE_FK_VIOLATION -- a stale/nonexistent assigneeId is translated to
  // a friendly error, not thrown uncaught (review-patch: assignBacklogIssue
  // previously had no try/catch around repo.updateAssignee at all, unlike
  // its pullBacklogIssue sibling).
  {
    const repo = makeFakeRepo();
    const pulled = await pullBacklogIssue(repo, activeSprint1, validInput);
    assert.ok(pulled.ok);
    const result = await assignBacklogIssue(repo, activeSprint1, {
      issueId: pulled.data.id,
      assigneeId: "no-such-team-member",
    });
    assert.equal(result.ok, false, "an FK-violating assigneeId should be rejected, not thrown");
    assert.ok(!result.ok);
    assert.equal(result.error, "Selected Team Member no longer exists.");
  }

  // EMPTY_STRING_ASSIGNEE -- "" is normalized to null server-side (review-patch:
  // previously only the UI normalized this before calling the action, so a
  // direct call with "" would have hit the FK constraint instead of clearing).
  {
    const repo = makeFakeRepo();
    const pulled = await pullBacklogIssue(repo, activeSprint1, validInput);
    assert.ok(pulled.ok);
    await assignBacklogIssue(repo, activeSprint1, { issueId: pulled.data.id, assigneeId: "tm-ada" });
    const result = await assignBacklogIssue(repo, activeSprint1, {
      issueId: pulled.data.id,
      assigneeId: "", // deliberately "" -- the type allows it (a raw API call could send it too)
    });
    assert.equal(result.ok, true, "an empty-string assigneeId should be treated as clearing the assignment");
    assert.ok(result.ok);
    assert.equal(result.data.assigneeId, null, "\"\" should normalize to null, not persist as a literal empty string");
  }

  // Story 3.5 -- sumEstimateHours/sumAssignedHoursByMember. A mix of
  // assigned and unassigned issues: unassigned hours count toward the team
  // total but no member's individual total.
  {
    const issues: BacklogIssue[] = [
      { id: "bi-1", youtrackIssueId: "P-1", sprintId: "s-1", title: "a", assigneeId: "tm-ada", estimateHours: 5, loggedHours: 0, loggedHoursPulledAt: null },
      { id: "bi-2", youtrackIssueId: "P-2", sprintId: "s-1", title: "b", assigneeId: "tm-ada", estimateHours: 3, loggedHours: 0, loggedHoursPulledAt: null },
      { id: "bi-3", youtrackIssueId: "P-3", sprintId: "s-1", title: "c", assigneeId: "tm-grace", estimateHours: 4, loggedHours: 0, loggedHoursPulledAt: null },
      { id: "bi-4", youtrackIssueId: "P-4", sprintId: "s-1", title: "d", assigneeId: null, estimateHours: 2, loggedHours: 0, loggedHoursPulledAt: null },
    ];
    assert.equal(sumEstimateHours(issues), 14, "team total should include every issue, assigned or not");
    assert.equal(sumEstimateHours([]), 0, "an empty list sums to 0");

    const byMember = sumAssignedHoursByMember(issues);
    assert.equal(byMember.get("tm-ada"), 8, "tm-ada's two issues should sum to 8");
    assert.equal(byMember.get("tm-grace"), 4, "tm-grace's one issue should be 4");
    assert.equal(byMember.has("tm-none"), false, "an unassigned issue should not create any member entry");
    assert.equal(byMember.size, 2, "only the two assigned members should have entries");
  }

  console.log("backlog-issue.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("backlog-issue.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
