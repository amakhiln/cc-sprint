"use server";

import { revalidatePath } from "next/cache";
import {
  addTeamMember,
  archiveTeamMember,
  updateTeamMemberWorkingHours,
  type AddTeamMemberResult,
  type ArchiveTeamMemberResult,
  type UpdateTeamMemberWorkingHoursResult,
} from "@/domain/allocation";
import { teamMemberRepository } from "@/infrastructure/db/team-member-repository";

export async function addTeamMemberAction(
  formData: FormData,
): Promise<AddTeamMemberResult> {
  const nameRaw = formData.get("name");
  const workingHoursRaw = formData.get("workingHoursPerDay");

  if (typeof nameRaw !== "string" || typeof workingHoursRaw !== "string") {
    return { ok: false, error: "Invalid form submission" };
  }

  const workingHoursPerDay = workingHoursRaw !== "" ? Number(workingHoursRaw) : undefined;

  try {
    const result = await addTeamMember(teamMemberRepository, {
      name: nameRaw,
      workingHoursPerDay,
    });

    if (result.ok) {
      try {
        revalidatePath("/roster");
        // Story 4.1 -- the Sprint Plan Overview (home route) also reads
        // TeamMember data.
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
    console.error("addTeamMemberAction failed:", error);
    return { ok: false, error: "Failed to add team member. Please try again." };
  }
}

export async function removeTeamMemberAction(
  id: string,
): Promise<ArchiveTeamMemberResult> {
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Invalid team member id" };
  }

  try {
    const result = await archiveTeamMember(teamMemberRepository, id);

    if (result.ok) {
      try {
        revalidatePath("/roster");
        // Story 4.1 -- the Sprint Plan Overview (home route) also reads
        // TeamMember data.
        revalidatePath("/");
      } catch (revalidateError) {
        // The record was already archived -- a revalidation hiccup shouldn't
        // report failure and risk a confusing duplicate resubmission.
        console.error("revalidatePath('/roster') failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    // Never throw to the caller, and never leak internal error details.
    console.error("removeTeamMemberAction failed:", error);
    return { ok: false, error: "Failed to remove team member. Please try again." };
  }
}

export async function updateTeamMemberWorkingHoursAction(
  id: string,
  workingHoursPerDay: number,
): Promise<UpdateTeamMemberWorkingHoursResult> {
  if (typeof id !== "string" || !id || typeof workingHoursPerDay !== "number") {
    return { ok: false, error: "Invalid working hours submission" };
  }

  try {
    const result = await updateTeamMemberWorkingHours(teamMemberRepository, id, workingHoursPerDay);

    if (result.ok) {
      try {
        revalidatePath("/roster");
        // Story 4.1 -- the Sprint Plan Overview (home route) also reads
        // TeamMember data.
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
    console.error("updateTeamMemberWorkingHoursAction failed:", error);
    return { ok: false, error: "Failed to update working hours. Please try again." };
  }
}
