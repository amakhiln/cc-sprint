"use server";

import { revalidatePath } from "next/cache";
import { recordHoliday, type RecordHolidayResult } from "@/domain/holiday";
import { holidayRepository } from "@/infrastructure/db/holiday-repository";

export async function recordHolidayAction(
  startDate: string,
  endDate: string,
): Promise<RecordHolidayResult> {
  if (typeof startDate !== "string" || typeof endDate !== "string") {
    return { ok: false, error: "Invalid holiday submission" };
  }

  // YYYY-MM-DD from <input type="date">: plain `new Date(...)` parses this
  // as UTC midnight per spec -- already correct for a day-granularity,
  // no-time-of-day field, no timezone conversion needed.
  try {
    const result = await recordHoliday(holidayRepository, {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    if (result.ok) {
      try {
        revalidatePath("/leave");
        // Roster's Capacity Ledgers (Story 2.5) read every Holiday on every
        // render -- without this, a newly-recorded Holiday leaves Roster
        // showing stale, pre-Holiday figures until something unrelated
        // revalidates it.
        revalidatePath("/roster");
        // Story 4.1 -- the Sprint Plan Overview (home route) also reads
        // every Holiday on every render, same reasoning as Roster above.
        revalidatePath("/");
      } catch (revalidateError) {
        // The record was already saved -- a revalidation hiccup shouldn't
        // report failure and risk a confusing duplicate resubmission.
        console.error("revalidatePath failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    // Never throw to the caller, and never leak internal error details.
    console.error("recordHolidayAction failed:", error);
    return { ok: false, error: "Failed to record holiday. Please try again." };
  }
}
