// Runnable self-check for the pure allocation domain logic -- no test
// framework installed (see AGENTS.md / project conventions), so this is a
// plain assert-based script. Run with: node domain/allocation.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.

import assert from "node:assert/strict";
import {
  setTeamMemberAllocations,
  removeAllocationCategory,
  setDevAllocationCategory,
  unsetDevAllocationCategory,
  addTeamMember,
  updateTeamMemberWorkingHours,
  type TeamMemberAllocation,
  type TeamMemberAllocationRepo,
  type AllocationCategory,
  type AllocationCategoryRepo,
  type TeamMember,
  type TeamMemberRepo,
} from "./allocation.ts";

// --- fake in-memory repos, matching the port shapes ---

function makeFakeAllocationRepo(initial: TeamMemberAllocation[] = []): TeamMemberAllocationRepo & {
  rows: TeamMemberAllocation[];
} {
  let rows = [...initial];
  let nextId = 1;
  return {
    get rows() {
      return rows;
    },
    async listForTeamMember(teamMemberId) {
      return rows.filter((r) => r.teamMemberId === teamMemberId);
    },
    async replaceForTeamMember(teamMemberId, allocations) {
      rows = rows.filter((r) => r.teamMemberId !== teamMemberId);
      const created = allocations.map((a) => ({
        id: `alloc-${nextId++}`,
        teamMemberId,
        categoryId: a.categoryId,
        percent: a.percent,
      }));
      rows = [...rows, ...created];
      return created;
    },
    async isCategoryInUse(categoryId) {
      return rows.some((r) => r.categoryId === categoryId);
    },
  };
}

function makeFakeCategoryRepo(initial: AllocationCategory[]): AllocationCategoryRepo & {
  categories: AllocationCategory[];
} {
  const categories = [...initial];
  return {
    get categories() {
      return categories;
    },
    async create(data) {
      const cat = { id: `cat-${categories.length + 1}`, name: data.name, isDev: false };
      categories.push(cat);
      return cat;
    },
    async list() {
      return categories;
    },
    async rename(id, name) {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return null;
      cat.name = name;
      return cat;
    },
    async remove(id) {
      const idx = categories.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      const [removed] = categories.splice(idx, 1);
      return removed;
    },
    async setDev(id) {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return null;
      // Mirrors the real repo's transaction: unset whichever category
      // currently holds isDev, then set this one -- at most one true at a time.
      categories.forEach((c) => (c.isDev = false));
      cat.isDev = true;
      return cat;
    },
    async unsetDev(id) {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return null;
      cat.isDev = false;
      return cat;
    },
  };
}

function makeFakeTeamMemberRepo(initial: TeamMember[] = []): TeamMemberRepo & { members: TeamMember[] } {
  const members = [...initial];
  let nextId = 1;
  return {
    get members() {
      return members;
    },
    async create(data) {
      const member: TeamMember = {
        id: `tm-${nextId++}`,
        name: data.name,
        workingHoursPerDay: data.workingHoursPerDay,
        archivedAt: null,
      };
      members.push(member);
      return member;
    },
    async list() {
      return members.filter((m) => !m.archivedAt);
    },
    async archive(id) {
      const member = members.find((m) => m.id === id && !m.archivedAt);
      if (!member) return null;
      member.archivedAt = new Date();
      return member;
    },
    async updateWorkingHours(id, workingHoursPerDay) {
      const member = members.find((m) => m.id === id);
      if (!member) return null;
      member.workingHoursPerDay = workingHoursPerDay;
      return member;
    },
  };
}

async function main() {
  // 1. Duplicate categoryId in the input array is rejected.
  {
    const repo = makeFakeAllocationRepo();
    const result = await setTeamMemberAllocations(repo, "tm-1", [
      { categoryId: "cat-a", percent: 50 },
      { categoryId: "cat-a", percent: 50 },
    ]);
    assert.equal(result.ok, false, "duplicate categoryId should be rejected");
    assert.equal(repo.rows.length, 0, "no record should be changed on rejection");
  }

  // 2. Negative or non-integer percent is rejected.
  {
    const repo = makeFakeAllocationRepo();
    const negative = await setTeamMemberAllocations(repo, "tm-1", [
      { categoryId: "cat-a", percent: -10 },
    ]);
    assert.equal(negative.ok, false, "negative percent should be rejected");

    const nonInt = await setTeamMemberAllocations(repo, "tm-1", [
      { categoryId: "cat-a", percent: 50.5 },
    ]);
    assert.equal(nonInt.ok, false, "non-integer percent should be rejected");
    assert.equal(repo.rows.length, 0, "no record should be changed on rejection");

    const tooHigh = await setTeamMemberAllocations(repo, "tm-1", [
      { categoryId: "cat-a", percent: 101 },
    ]);
    assert.equal(tooHigh.ok, false, "percent over 100 should be rejected");
    assert.equal(repo.rows.length, 0, "no record should be changed on rejection");
  }

  // 3. A zero-percent row is dropped before persisting.
  {
    const repo = makeFakeAllocationRepo();
    const result = await setTeamMemberAllocations(repo, "tm-1", [
      { categoryId: "cat-a", percent: 60 },
      { categoryId: "cat-b", percent: 0 },
    ]);
    assert.equal(result.ok, true, "valid allocation set should be accepted");
    assert.ok(result.ok);
    assert.equal(result.data.length, 1, "zero-percent row should be dropped");
    assert.equal(result.data[0].categoryId, "cat-a");
  }

  // 3b. An all-zero allocation set is accepted and persists zero rows.
  {
    const repo = makeFakeAllocationRepo();
    const result = await setTeamMemberAllocations(repo, "tm-1", [
      { categoryId: "cat-a", percent: 0 },
      { categoryId: "cat-b", percent: 0 },
    ]);
    assert.equal(result.ok, true, "an all-zero allocation set should be accepted");
    assert.ok(result.ok);
    assert.equal(result.data.length, 0, "no rows should be persisted for an all-zero set");
    assert.equal(repo.rows.length, 0, "repo should hold zero rows for the team member");
  }

  // 4. removeAllocationCategory rejects when isCategoryInUse returns true.
  {
    const categoryRepo = makeFakeCategoryRepo([{ id: "cat-a", name: "Engineering", isDev: false }]);
    const inUseAllocationRepo = makeFakeAllocationRepo([
      { id: "alloc-1", teamMemberId: "tm-1", categoryId: "cat-a", percent: 100 },
    ]);

    const rejected = await removeAllocationCategory(categoryRepo, inUseAllocationRepo, "cat-a");
    assert.equal(rejected.ok, false, "removal should be rejected while category is in use");
    assert.equal(categoryRepo.categories.length, 1, "category should not be removed");

    // Sanity: once not in use, removal succeeds.
    const freeAllocationRepo = makeFakeAllocationRepo([]);
    const accepted = await removeAllocationCategory(categoryRepo, freeAllocationRepo, "cat-a");
    assert.equal(accepted.ok, true, "removal should succeed once category is not in use");
    assert.equal(categoryRepo.categories.length, 0);
  }

  // 4b. setDevAllocationCategory: marking a new category as Dev unsets the
  // previous one; unknown id is rejected, not thrown.
  {
    const categoryRepo = makeFakeCategoryRepo([
      { id: "cat-a", name: "Dev", isDev: false },
      { id: "cat-b", name: "Management", isDev: false },
    ]);

    const first = await setDevAllocationCategory(categoryRepo, "cat-a");
    assert.equal(first.ok, true, "marking an existing category as Dev should succeed");
    assert.equal(categoryRepo.categories.find((c) => c.id === "cat-a")?.isDev, true);

    const second = await setDevAllocationCategory(categoryRepo, "cat-b");
    assert.equal(second.ok, true, "marking a different category as Dev should succeed");
    assert.equal(
      categoryRepo.categories.find((c) => c.id === "cat-a")?.isDev,
      false,
      "the previous Dev category should be unset",
    );
    assert.equal(categoryRepo.categories.find((c) => c.id === "cat-b")?.isDev, true);

    const notFound = await setDevAllocationCategory(categoryRepo, "cat-missing");
    assert.equal(notFound.ok, false, "unknown id should be rejected, not thrown");

    const blank = await setDevAllocationCategory(categoryRepo, "  ");
    assert.equal(blank.ok, false, "blank id should be rejected");

    const unset = await unsetDevAllocationCategory(categoryRepo, "cat-b");
    assert.equal(unset.ok, true, "unmarking the current Dev category should succeed");
    assert.equal(
      categoryRepo.categories.every((c) => !c.isDev),
      true,
      "no category should be Dev after unmarking",
    );

    const unsetNotFound = await unsetDevAllocationCategory(categoryRepo, "cat-missing");
    assert.equal(unsetNotFound.ok, false, "unmarking an unknown id should be rejected, not thrown");
  }

  // 4c. Removing the current Dev category leaves zero categories marked Dev
  // (no dangling/duplicate isDev=true row survives a plain remove()).
  {
    const categoryRepo = makeFakeCategoryRepo([{ id: "cat-a", name: "Dev", isDev: false }]);
    await setDevAllocationCategory(categoryRepo, "cat-a");
    assert.equal(categoryRepo.categories[0].isDev, true);

    const freeAllocationRepo = makeFakeAllocationRepo([]);
    const removed = await removeAllocationCategory(categoryRepo, freeAllocationRepo, "cat-a");
    assert.equal(removed.ok, true, "removing the Dev category should succeed like any other");
    assert.equal(categoryRepo.categories.length, 0, "the Dev category should be gone");
  }

  // 5. addTeamMember's working-hours validation is unchanged after extraction.
  {
    const repo = makeFakeTeamMemberRepo();
    const valid = await addTeamMember(repo, { name: "Ada", workingHoursPerDay: 6 });
    assert.equal(valid.ok, true, "valid working hours should be accepted");

    const zero = await addTeamMember(repo, { name: "Bea", workingHoursPerDay: 0 });
    assert.equal(zero.ok, false, "0 working hours should be rejected");
    assert.ok(!zero.ok);
    assert.match(zero.error, /between 1 and 24/, "error message should be unchanged");

    const tooHigh = await addTeamMember(repo, { name: "Cid", workingHoursPerDay: 25 });
    assert.equal(tooHigh.ok, false, ">24 working hours should be rejected");

    const nonInt = await addTeamMember(repo, { name: "Dee", workingHoursPerDay: 6.5 });
    assert.equal(nonInt.ok, false, "non-integer working hours should be rejected");

    assert.equal(repo.members.length, 1, "only the valid member should have been created");
  }

  // 6. updateTeamMemberWorkingHours: valid, 0, >24, non-integer, not-found.
  {
    const repo = makeFakeTeamMemberRepo([
      { id: "tm-1", name: "Ada", workingHoursPerDay: 8, archivedAt: null },
    ]);

    const valid = await updateTeamMemberWorkingHours(repo, "tm-1", 4);
    assert.equal(valid.ok, true, "valid working hours update should be accepted");
    assert.equal(repo.members[0].workingHoursPerDay, 4, "working hours should be persisted");

    const zero = await updateTeamMemberWorkingHours(repo, "tm-1", 0);
    assert.equal(zero.ok, false, "0 working hours should be rejected");
    assert.equal(repo.members[0].workingHoursPerDay, 4, "no change should persist on rejection");

    const tooHigh = await updateTeamMemberWorkingHours(repo, "tm-1", 25);
    assert.equal(tooHigh.ok, false, ">24 working hours should be rejected");
    assert.equal(repo.members[0].workingHoursPerDay, 4, "no change should persist on rejection");

    const nonInt = await updateTeamMemberWorkingHours(repo, "tm-1", 4.5);
    assert.equal(nonInt.ok, false, "non-integer working hours should be rejected");
    assert.equal(repo.members[0].workingHoursPerDay, 4, "no change should persist on rejection");

    const notFound = await updateTeamMemberWorkingHours(repo, "tm-missing", 5);
    assert.equal(notFound.ok, false, "unknown id should be rejected, not thrown");
    assert.ok(!notFound.ok);
    assert.equal(notFound.error, "Team member not found");
  }

  console.log("allocation.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("allocation.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
