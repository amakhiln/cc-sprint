"use client";

import { useActionState } from "react";
import { addAllocationCategoryAction } from "@/app/actions/allocation-categories";
import type { AddAllocationCategoryResult } from "@/domain/allocation";

export function AddAllocationCategoryForm() {
  const [state, formAction, pending] = useActionState<
    AddAllocationCategoryResult | null,
    FormData
  >((_prevState, formData) => addAllocationCategoryAction(formData), null);

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Category Name</span>
        <input
          type="text"
          name="name"
          required
          className="rounded-sm border border-border bg-white/40 px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-sm bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add Category"}
      </button>
    </form>
  );
}
