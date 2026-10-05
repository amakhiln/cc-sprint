"use client";

import { useState, useTransition } from "react";
import { recordLeaveAction } from "@/app/actions/leave";
import type { LeaveType } from "@/domain/leave";
import { Button } from "@/components/ui/button";

export function LeaveEntryForm({
  teamMemberId,
  onSaved,
}: {
  teamMemberId: string;
  onSaved: () => void;
}) {
  const [type, setType] = useState<LeaveType>("planned");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await recordLeaveAction(teamMemberId, type, startDate, endDate);
        if (result.ok) {
          setType("planned");
          setStartDate("");
          setEndDate("");
          onSaved();
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="font-heading text-sm font-medium text-foreground">Log Leave</p>
      <div className="flex gap-1.5" aria-label="Leave type">
        <Button
          type="button"
          size="sm"
          variant={type === "planned" ? "default" : "outline"}
          disabled={pending}
          aria-pressed={type === "planned"}
          onClick={() => {
            setType("planned");
            setError(null);
          }}
          className="flex-1"
        >
          Planned
        </Button>
        <Button
          type="button"
          size="sm"
          variant={type === "emergency" ? "default" : "outline"}
          disabled={pending}
          aria-pressed={type === "emergency"}
          onClick={() => {
            setType("emergency");
            setError(null);
          }}
          className="flex-1"
        >
          Emergency
        </Button>
      </div>
      <div>
        <label
          htmlFor="leave-start-date"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Start Date
        </label>
        <input
          id="leave-start-date"
          type="date"
          value={startDate}
          required
          disabled={pending}
          onChange={(event) => setStartDate(event.target.value)}
          className="w-full rounded-sm border border-border bg-white/40 px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>
      <div>
        <label
          htmlFor="leave-end-date"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          End Date
        </label>
        <input
          id="leave-end-date"
          type="date"
          value={endDate}
          required
          disabled={pending}
          onChange={(event) => setEndDate(event.target.value)}
          className="w-full rounded-sm border border-border bg-white/40 px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="button" disabled={pending} onClick={handleSave} className="w-full">
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
