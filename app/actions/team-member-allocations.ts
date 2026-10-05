"use server";

import { revalidatePath } from "next/cache";
import {
  setTeamMemberAllocations,
  type SetTeamMemberAllocationsResult,
} from "@/domain/allocation";
import { teamMemberAllocationRepository } from "@/infrastructure/db/team-member-allocation-repository";

export async function setTeamMemberAllocationsAction(
  teamMemberId: string,
  allocations: { categoryId: string; percent: number }[],
): Promise<SetTeamMemberAllocationsResult> {
  if (
    typeof teamMemberId !== "string" ||
    !teamMemberId ||
    !Array.isArray(allocations) ||
    !allocations.every(
      (allocation) =>
        allocation &&
        typeof allocation.categoryId === "string" &&
        typeof allocation.percent === "number",
    )
  ) {
    return { ok: false, error: "Invalid allocation submission" };
  }

  try {
    const result = await setTeamMemberAllocations(
      teamMemberAllocationRepository,
      teamMemberId,
      allocations,
    );

    if (result.ok) {
      try {
        revalidatePath("/roster");
        // Story 4.1 -- the Sprint Plan Overview (home route) also reads
        // per-member Allocation data.
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
    console.error("setTeamMemberAllocationsAction failed:", error);
    return { ok: false, error: "Failed to save allocations. Please try again." };
  }
}
