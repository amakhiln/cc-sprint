"use client";

import { useActionState } from "react";
import { addTeamMemberAction } from "@/app/actions/team-members";
import type { AddTeamMemberResult } from "@/domain/allocation";

export function AddTeamMemberForm() {
  const [state, formAction, pending] = useActionState<
    AddTeamMemberResult | null,
    FormData
  >((_prevState, formData) => addTeamMemberAction(formData), null);

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Name</span>
        <input
          type="text"
          name="name"
          required
          className="rounded-sm border border-border bg-white/40 px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Working Hours per Day</span>
        <input
          type="number"
          name="workingHoursPerDay"
          defaultValue={8}
          min={1}
          max={24}
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
        {pending ? "Adding…" : "Add Team Member"}
      </button>
    </form>
  );
}
