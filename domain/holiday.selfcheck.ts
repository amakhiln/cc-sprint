// Runnable self-check for the pure holiday domain logic -- no test framework
// installed (see AGENTS.md / project conventions), so this is a plain
// assert-based script. Run with: node domain/holiday.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.

import assert from "node:assert/strict";
import { recordHoliday, type Holiday, type HolidayRepo } from "./holiday.ts";

// --- fake in-memory repo, matching the port shape ---

function makeFakeHolidayRepo(): HolidayRepo & {
  created: { startDate: Date; endDate: Date }[];
} {
  const created: { startDate: Date; endDate: Date }[] = [];
  return {
    created,
    async list() {
      return [];
    },
    async create(data) {
      created.push(data);
      const holiday: Holiday = {
        id: `holiday-${created.length}`,
        startDate: data.startDate,
        endDate: data.endDate,
      };
      return holiday;
    },
  };
}

async function main() {
  // 1. HAPPY_PATH: valid start/end (end >= start).
  {
    const repo = makeFakeHolidayRepo();
    const result = await recordHoliday(repo, {
      startDate: new Date("2026-12-25"),
      endDate: new Date("2026-12-26"),
    });
    assert.equal(result.ok, true, "valid input should be accepted");
    assert.ok(result.ok);
    assert.equal(repo.created.length, 1);
  }

  // Same-day (end === start) should also be accepted -- inclusive on both
  // ends.
  {
    const repo = makeFakeHolidayRepo();
    const sameDay = new Date("2026-12-25");
    const result = await recordHoliday(repo, {
      startDate: sameDay,
      endDate: sameDay,
    });
    assert.equal(result.ok, true, "a single-day holiday (end === start) should be accepted");
  }

  // 2. INVALID_DATE_RANGE: endDate before startDate.
  {
    const repo = makeFakeHolidayRepo();
    const result = await recordHoliday(repo, {
      startDate: new Date("2026-12-26"),
      endDate: new Date("2026-12-25"),
    });
    assert.equal(result.ok, false, "endDate before startDate should be rejected");
    assert.equal(repo.created.length, 0, "no record should be created");
  }

  // 3. INVALID_DATES: missing or unparseable start or end date.
  {
    const repo = makeFakeHolidayRepo();
    const badStart = await recordHoliday(repo, {
      startDate: new Date("not-a-date"),
      endDate: new Date("2026-12-26"),
    });
    assert.equal(badStart.ok, false, "an invalid start Date should be rejected");

    const badEnd = await recordHoliday(repo, {
      startDate: new Date("2026-12-25"),
      endDate: new Date("not-a-date"),
    });
    assert.equal(badEnd.ok, false, "an invalid end Date should be rejected");
    assert.equal(repo.created.length, 0);
  }

  console.log("holiday.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("holiday.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
