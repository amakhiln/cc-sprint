"use client";

import { useRef, useState, useTransition, type MouseEvent } from "react";
import { removeTeamMemberAction } from "@/app/actions/team-members";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function RemoveTeamMemberButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Tracks whether the dialog is closing because removal succeeded, so
  // onCloseAutoFocus (below) knows to redirect focus instead of letting
  // Radix return it to the trigger button, which is about to unmount.
  const removedRef = useRef(false);

  function handleConfirm(event: MouseEvent) {
    // Radix's AlertDialogAction dismisses the dialog on click by default;
    // prevent that so a failed removal can show its error without the
    // dialog disappearing out from under it.
    event.preventDefault();
    if (pending) return;
    startTransition(async () => {
      try {
        const result = await removeTeamMemberAction(id);
        if (result.ok) {
          removedRef.current = true;
          setOpen(false);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Don't let Escape/outside-click close the dialog mid-request --
        // the eventual result would apply to an already-closed dialog and a
        // failure would have nowhere to render.
        if (pending) return;
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // The row (including this trigger button) unmounts on a
          // successful removal, so there's nothing left for Radix's default
          // return-focus-to-trigger behavior to land on -- redirect it
          // somewhere sensible instead of letting focus fall through to
          // <body>. On cancel/failed removal the trigger still exists, so
          // let Radix's default behavior run.
          if (removedRef.current) {
            event.preventDefault();
            document.getElementById("roster-heading")?.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {name} from the active roster.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={handleConfirm}>
            {pending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
