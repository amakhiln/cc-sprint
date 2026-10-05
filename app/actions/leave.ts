"use server";

import { revalidatePath } from "next/cache";
import { recordLeave, type LeaveType, type RecordLeaveResult } from "@/domain/leave";
import { leaveRepository } from "@/infrastructure/db/leave-repository";

export async function recordLeaveAction(
  teamMemberId: string,
  type: LeaveType,
  startDate: string,
  endDate: string,
): Promise<RecordLeaveResult> {
  if (
    typeof teamMemberId !== "string" ||
    !teamMemberId ||
    (type !== "planned" && type !== "emergency") ||
    typeof startDate !== "string" ||
    typeof endDate !== "string"
  ) {
    return { ok: false, error: "Invalid leave submission" };
  }

  // YYYY-MM-DD from <input type="date">: plain `new Date(...)` parses this
  // as UTC midnight per spec -- already correct for a day-granularity,
  // no-time-of-day field, no timezone conversion needed.
  try {
    const result = await recordLeave(leaveRepository, {
      teamMemberId,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    if (result.ok) {
      try {
        revalidatePath("/roster");
        // Story 4.1 -- the Sprint Plan Overview (home route) also reads
        // per-member Leave data.
        revalidatePath("/");
      } catch (revalidateError) {
        // The record was already saved -- a revalidation hiccup shouldn't
        // report failure and risk a confusing duplicate resubmission.
        console.error("revalidatePath('/roster') failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    // Never throw to the caller, and never leak internal error details.
    console.error("recordLeaveAction failed:", error);
    return { ok: false, error: "Failed to record leave. Please try again." };
  }
}
