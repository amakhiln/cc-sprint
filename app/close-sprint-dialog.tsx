"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfettiBurst } from "@/components/confetti-burst";
import {
  initiateSprintCloseAction,
  confirmSprintCloseAction,
  type SprintCloseIssuePreview,
} from "@/app/actions/sprint";

type Row = SprintCloseIssuePreview & { hours: number };

// Sprint Close celebration length -- long enough to register as a moment,
// short enough not to make the PM wait to get back to work (delight.md:
// "delight moments should be quick, < 1s core action, never block").
const CELEBRATION_MS = 1700;

// Story 4.2 -- Sprint Close Flow (EXPERIENCE.md Component Patterns): a
// modal, not a full-page navigation. Reviewing the pulled figures and
// clicking "Confirm and close" IS the confirmation step -- no separate
// are-you-sure layer on top of it.
export function CloseSprintDialog({ sprintId }: { sprintId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [pending, startTransition] = useTransition();
  const celebrationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (celebrationTimeout.current) clearTimeout(celebrationTimeout.current);
    };
  }, []);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (celebrationTimeout.current) {
      clearTimeout(celebrationTimeout.current);
      celebrationTimeout.current = null;
    }
    setOpen(next);
    if (!next) return;
    setRows(null);
    setError(null);
    setCelebrating(false);
    setLoading(true);
    startTransition(async () => {
      const result = await initiateSprintCloseAction(sprintId);
      setLoading(false);
      if (result.ok) {
        setRows(result.data.map((issue) => ({ ...issue, hours: issue.pulledHours ?? 0 })));
      } else {
        setError(result.error);
      }
    });
  }

  function handleHoursChange(issueId: string, rawValue: string) {
    // Never let an unparseable/negative value (an emptied or partially-typed
    // input, e.g. a bare "-") reach state -- it would otherwise show "NaNh"
    // in the running total and reach confirmSprintCloseAction, which the
    // domain layer would then reject with no indication of which row is at
    // fault (review-patch: Edge Case Hunter found the input had no real
    // client-side guard).
    const parsed = Number(rawValue);
    const hours = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setRows((current) => current?.map((row) => (row.issueId === issueId ? { ...row, hours } : row)) ?? current);
  }

  function handleConfirm() {
    if (!rows || pending) return;
    setError(null);
    startTransition(async () => {
      const confirmedHoursByIssueId = Object.fromEntries(rows.map((row) => [row.issueId, row.hours]));
      const result = await confirmSprintCloseAction(sprintId, confirmedHoursByIssueId);
      if (result.ok) {
        setCelebrating(true);
        celebrationTimeout.current = setTimeout(() => setOpen(false), CELEBRATION_MS);
      } else {
        setError(result.error);
      }
    });
  }

  const total = rows?.reduce((sum, row) => sum + row.hours, 0) ?? 0;
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Close Sprint
        </Button>
      </DialogTrigger>
      <DialogContent>
        {celebrating ? (
          <div className="relative flex flex-col items-center gap-3 py-6 text-center">
            {!prefersReducedMotion && <ConfettiBurst />}
            <svg viewBox="0 0 52 52" className="h-14 w-14">
              <circle
                cx="26"
                cy="26"
                r="24"
                fill="none"
                stroke="var(--accent-mint)"
                strokeWidth="3"
                pathLength={151}
                strokeDasharray={151}
                className="checkmark-circle"
              />
              <path
                d="M14 27l7 7 16-16"
                fill="none"
                stroke="var(--accent-mint)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={36}
                strokeDasharray={36}
                className="checkmark-check"
              />
            </svg>
            <DialogTitle className="font-heading text-lg font-medium text-foreground">Sprint closed</DialogTitle>
            <DialogDescription>These figures are now locked into Velocity History.</DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Close Sprint</DialogTitle>
              <DialogDescription>
                Review each assigned issue&apos;s logged hours before confirming. Closing locks these figures into Velocity History and makes the Sprint read-only.
              </DialogDescription>
            </DialogHeader>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows && rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assigned issues in this Sprint.</p>
            ) : rows ? (
              <ul className="-mr-2 flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-2">
                {rows.map((row) => (
                  <li key={row.issueId} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{row.title}</p>
                      {row.pulledHours === null ? (
                        <p className="text-xs italic text-muted-foreground">Not yet checked</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{row.pulledHours.toFixed(1)}h logged</p>
                      )}
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={row.hours}
                      onChange={(event) => handleHoursChange(row.issueId, event.target.value)}
                      className="w-20 shrink-0 rounded-sm border border-border bg-white/40 px-2 py-1 text-right text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                  </li>
                ))}
              </ul>
            ) : null}

            {rows && (
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm font-medium text-foreground">
                <span>Total</span>
                <span>{total.toFixed(1)}h</span>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button" onClick={handleConfirm} disabled={!rows || pending}>
                {pending ? "Closing…" : "Confirm and close"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
