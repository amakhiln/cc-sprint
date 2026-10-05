"use client";

import { useState, useTransition } from "react";
import { recordHolidayAction } from "@/app/actions/holiday";

export function AddHolidayForm() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await recordHolidayAction(startDate, endDate);
        if (result.ok) {
          setStartDate("");
          setEndDate("");
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Start Date</span>
        <input
          type="date"
          value={startDate}
          required
          disabled={pending}
          onChange={(event) => {
            setStartDate(event.target.value);
            setError(null);
          }}
          className="rounded-sm border border-border bg-white/40 px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">End Date</span>
        <input
          type="date"
          value={endDate}
          required
          disabled={pending}
          onChange={(event) => {
            setEndDate(event.target.value);
            setError(null);
          }}
          className="rounded-sm border border-border bg-white/40 px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-sm bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add Holiday"}
      </button>
    </form>
  );
}
