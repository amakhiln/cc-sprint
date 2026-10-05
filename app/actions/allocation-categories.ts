"use server";

import { revalidatePath } from "next/cache";
import {
  addAllocationCategory,
  renameAllocationCategory,
  removeAllocationCategory,
  setDevAllocationCategory,
  unsetDevAllocationCategory,
  type AddAllocationCategoryResult,
  type RenameAllocationCategoryResult,
  type RemoveAllocationCategoryResult,
  type SetDevAllocationCategoryResult,
  type UnsetDevAllocationCategoryResult,
} from "@/domain/allocation";
import { allocationCategoryRepository } from "@/infrastructure/db/allocation-category-repository";
import { teamMemberAllocationRepository } from "@/infrastructure/db/team-member-allocation-repository";

export async function addAllocationCategoryAction(
  formData: FormData,
): Promise<AddAllocationCategoryResult> {
  const nameRaw = formData.get("name");

  if (typeof nameRaw !== "string") {
    return { ok: false, error: "Invalid form submission" };
  }

  try {
    const result = await addAllocationCategory(allocationCategoryRepository, {
      name: nameRaw,
    });

    if (result.ok) {
      try {
        revalidatePath("/roster");
        // Story 4.1 -- the Sprint Plan Overview (home route) also reads
        // AllocationCategory data.
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
    console.error("addAllocationCategoryAction failed:", error);
    return { ok: false, error: "Failed to add category. Please try again." };
  }
}

export async function renameAllocationCategoryAction(
  id: string,
  name: string,
): Promise<RenameAllocationCategoryResult> {
  if (typeof id !== "string" || !id || typeof name !== "string") {
    return { ok: false, error: "Invalid rename request" };
  }

  try {
    const result = await renameAllocationCategory(allocationCategoryRepository, id, name);

    if (result.ok) {
      try {
        revalidatePath("/roster");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("revalidatePath('/roster') failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    console.error("renameAllocationCategoryAction failed:", error);
    return { ok: false, error: "Failed to rename category. Please try again." };
  }
}

export async function setDevAllocationCategoryAction(
  id: string,
): Promise<SetDevAllocationCategoryResult> {
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Invalid category id" };
  }

  try {
    const result = await setDevAllocationCategory(allocationCategoryRepository, id);

    if (result.ok) {
      try {
        revalidatePath("/roster");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("revalidatePath('/roster') failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    console.error("setDevAllocationCategoryAction failed:", error);
    return { ok: false, error: "Failed to mark category as Dev. Please try again." };
  }
}

export async function unsetDevAllocationCategoryAction(
  id: string,
): Promise<UnsetDevAllocationCategoryResult> {
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Invalid category id" };
  }

  try {
    const result = await unsetDevAllocationCategory(allocationCategoryRepository, id);

    if (result.ok) {
      try {
        revalidatePath("/roster");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("revalidatePath('/roster') failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    console.error("unsetDevAllocationCategoryAction failed:", error);
    return { ok: false, error: "Failed to unmark category as Dev. Please try again." };
  }
}

export async function removeAllocationCategoryAction(
  id: string,
): Promise<RemoveAllocationCategoryResult> {
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Invalid category id" };
  }

  try {
    const result = await removeAllocationCategory(
      allocationCategoryRepository,
      teamMemberAllocationRepository,
      id,
    );

    if (result.ok) {
      try {
        revalidatePath("/roster");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("revalidatePath('/roster') failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    console.error("removeAllocationCategoryAction failed:", error);
    return { ok: false, error: "Failed to remove category. Please try again." };
  }
}
