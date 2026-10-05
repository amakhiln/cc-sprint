"use client";

import { useState, useTransition } from "react";
import {
  renameAllocationCategoryAction,
  removeAllocationCategoryAction,
  setDevAllocationCategoryAction,
  unsetDevAllocationCategoryAction,
} from "@/app/actions/allocation-categories";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";

export function AllocationCategoryRow({
  id,
  name,
  isDev,
}: {
  id: string;
  name: string;
  isDev: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleToggleDev() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = isDev
          ? await unsetDevAllocationCategoryAction(id)
          : await setDevAllocationCategoryAction(id);
        if (!result.ok) {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function handleRename() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await renameAllocationCategoryAction(id, draft);
        if (result.ok) {
          setEditing(false);
          setError(null);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function handleRemove() {
    if (pending) return;
    // Removing the Dev category silently drops Capacity back to its
    // no-Dev-category state until someone marks a new one -- worth a
    // heads-up before it's gone, unlike a plain category removal.
    if (isDev && !window.confirm(`"${name}" is the current Dev category. Removing it means Capacity won't be computed until another category is marked Dev. Remove anyway?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await removeAllocationCategoryAction(id);
        // No dialog to close on success -- the row unmounts on its own once
        // the list re-renders without it. On failure, show the error inline.
        if (!result.ok) {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function cancelEditing() {
    setDraft(name);
    setEditing(false);
    setError(null);
  }

  return (
    <li className="glass-row flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {editing ? (
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleRename();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancelEditing();
              }
            }}
            disabled={pending}
            aria-label="Category name"
            className="flex-1 rounded-sm border border-border bg-white/40 px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            autoFocus
          />
        ) : (
          <span className="flex items-center gap-2 text-foreground">
            {name}
            {isDev && <StatusChip variant="neutral">Dev</StatusChip>}
          </span>
        )}
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button type="button" size="sm" disabled={pending} onClick={handleRename}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={cancelEditing}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                aria-pressed={isDev}
                onClick={handleToggleDev}
              >
                {pending ? "Saving…" : isDev ? "Unmark as Dev" : "Mark as Dev"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(name);
                  setError(null);
                  setEditing(true);
                }}
              >
                Rename
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleRemove}>
                {pending ? "Removing…" : "Remove"}
              </Button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
