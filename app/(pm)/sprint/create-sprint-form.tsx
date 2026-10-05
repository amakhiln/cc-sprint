"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createSprintAction } from "@/app/actions/sprint";
import type { CreateSprintResult } from "@/domain/sprint";

export function CreateSprintForm() {
  const [state, formAction, pending] = useActionState<
    CreateSprintResult | null,
    FormData
  >((_prevState, formData) => createSprintAction(formData), null);

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Start Date</span>
        <input
          type="date"
          name="startDate"
          required
          className="rounded-sm border border-border bg-white/40 px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Length (days)</span>
        <input
          type="number"
          name="lengthDays"
          defaultValue={14}
          min={1}
          max={365}
          className="rounded-sm border border-border bg-white/40 px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create Sprint"}
      </Button>
    </form>
  );
}
