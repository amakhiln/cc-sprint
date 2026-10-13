"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createSprintAction } from "@/app/actions/sprint";
import type { CreateSprintResult } from "@/domain/sprint";
import type { SprintSuggestion } from "@/domain/youtrack";

const INPUT_CLASS =
  "rounded-sm border border-border bg-white/40 px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50";

export function CreateSprintForm({
  suggestion,
  loadFailed,
}: {
  suggestion: SprintSuggestion | null;
  loadFailed: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    CreateSprintResult | null,
    FormData
  >((_prevState, formData) => createSprintAction(formData), null);

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      {suggestion && <p className="text-xs text-muted-foreground">From YouTrack: {suggestion.name}</p>}
      {loadFailed && <p className="text-xs text-muted-foreground">Couldn&apos;t load YouTrack sprints</p>}
      {/* Keeps the YouTrack link even if the PM edits the pre-filled fields. */}
      <input type="hidden" name="youtrackSprintId" value={suggestion?.youtrackSprintId ?? ""} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Name (optional)</span>
        <input
          type="text"
          name="name"
          defaultValue={suggestion?.name ?? ""}
          maxLength={100}
          placeholder="e.g. Sprint 22"
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Start Date</span>
        <input
          type="date"
          name="startDate"
          required
          defaultValue={suggestion?.startDate}
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Length (days)</span>
        <input
          type="number"
          name="lengthDays"
          defaultValue={suggestion?.lengthDays ?? 14}
          min={1}
          max={365}
          className={INPUT_CLASS}
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
