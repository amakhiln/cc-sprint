---
title: 'Remove Team Member'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Once a Team Member is added, there's no way to remove them from the active roster — mistakes or team changes can't be corrected, and the roster only ever grows.

**Approach:** Add a soft-delete (`archivedAt`) path through the same domain/infrastructure/action layers Story 1.2 established, plus a lightweight confirm-before-destructive dialog on the Roster page. This is also the first UI beyond plain Tailwind, so it initializes shadcn/ui (the UI system named in `EXPERIENCE.md` Foundation but not yet set up) and adds its `alert-dialog` component.

## Boundaries & Constraints

**Always:**
- Removal is a soft delete only: set `archivedAt` to the current timestamp. Never physically delete a `TeamMember` row.
- `domain/allocation.ts` gets an `archiveTeamMember(repo, id)` function following the same pattern as `addTeamMember`: framework-free, takes the repo as a parameter, returns the `{ok:true,data}` / `{ok:false,error}` discriminated result. Return `{ok:false}` if the id doesn't exist or is already archived (don't silently no-op).
- `TeamMemberRepo` gets an `archive(id): Promise<TeamMember>` method; `infrastructure/db/team-member-repository.ts` implements it via `prisma.teamMember.update`.
- Initialize shadcn/ui now (`npx shadcn init`, or equivalent for this Next.js/Tailwind v4 setup) and add its `alert-dialog` component — use it for the remove confirmation, per `EXPERIENCE.md`'s "lightweight confirmation dialog, not a full-page interstitial." Don't hand-rope a custom modal or use the native `window.confirm()` — the DESIGN.md visual system should apply to this dialog like everything else.
- The Roster page's per-member row gets a "Remove" action that opens the confirm dialog before calling the Server Action — no accidental one-click removal.
- After a successful removal, the member disappears from the Roster list immediately (the existing `list()` already filters `archivedAt: null`, so no repository change needed there).

**Ask First:**
- _None known._

**Never:**
- No un-archive/restore action yet — not in this story's AC, don't add it speculatively.
- No changes to Sprint, Capacity, or Velocity History — those don't exist yet; this story only needs the `TeamMember` row to survive removal, which the soft-delete already guarantees. Nothing to build or test there now.
- No raw Prisma calls from `app/` — the Server Action goes through `domain/allocation.ts`'s `archiveTeamMember`, same as Story 1.2.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Existing, active Team Member id | `archivedAt` set, member disappears from Roster list immediately | N/A |
| ALREADY_ARCHIVED | Team Member id that's already archived | Rejected, no-op on the row | Domain function returns `{ok:false, error}` rather than silently re-archiving |
| NOT_FOUND | Team Member id that doesn't exist | Rejected | Domain function returns `{ok:false, error}`, not an unhandled throw |

</frozen-after-approval>

## Code Map

- `domain/allocation.ts` — has `addTeamMember` (Story 1.2); add `archiveTeamMember` alongside it, reusing `TeamMember`/`TeamMemberRepo` types already defined here.
- `infrastructure/db/team-member-repository.ts` — has `create`/`list`; add `archive`.
- `app/actions/team-members.ts` — has `addTeamMemberAction`; add `removeTeamMemberAction`, same wiring/error-handling shape (type-guard input, try/catch, sanitized error message, isolated `revalidatePath`).
- `app/(pm)/roster/page.tsx` — currently renders a plain list with no per-row actions; add the Remove button + confirm dialog here.
- No `components.json`, `@radix-ui/*`, or `class-variance-authority` in `package.json` yet — shadcn/ui hasn't been initialized despite being named as the UI system in `EXPERIENCE.md` Foundation. This story does that setup.

## Tasks & Acceptance

**Execution:**
- [x] Initialize shadcn/ui (`npx shadcn init`) and add the `alert-dialog` component (`npx shadcn add alert-dialog`) -- first real UI-system setup, needed for the confirm dialog.
- [x] `domain/allocation.ts` -- add `archiveTeamMember(repo, id)`: rejects if the member doesn't exist or is already archived, otherwise calls `repo.archive(id)` and returns the discriminated result.
- [x] `infrastructure/db/team-member-repository.ts` -- add `archive(id)` implementing the new port method against Prisma.
- [x] `app/actions/team-members.ts` -- add `removeTeamMemberAction`, mirroring `addTeamMemberAction`'s error-handling shape.
- [x] `app/(pm)/roster/page.tsx` -- add a "Remove" button per row that opens a shadcn `AlertDialog` confirming the action before calling `removeTeamMemberAction`. (Split into a `remove-team-member-button.tsx` client component, same pattern as the add-form split in Story 1.2.)

**Acceptance Criteria:**
- Given a Team Member exists on the active roster, when I remove them (after confirming the dialog), then they no longer appear on the Roster, and their record is soft-deleted (`archivedAt` set), never physically deleted.
- Given I click Remove, when the confirm dialog appears, then canceling it leaves the Team Member untouched (no removal happens without explicit confirmation).
- Given a Team Member's `archivedAt` is already set (or the id doesn't exist), when removal is attempted again, then it's rejected with a clear error rather than silently succeeding or crashing.

## Spec Change Log

## Design Notes

`archiveTeamMember` mirrors `addTeamMember`'s shape exactly (repo-as-parameter, discriminated result, framework-free) — no new pattern to learn, just the second data point proving the ports-and-adapters convention from Story 1.2 generalizes cleanly. The one genuinely new piece is shadcn/ui's first real setup; once `alert-dialog` is wired up here, Story 4.2 (Close Sprint) can reuse the same component for its own confirm-before-destructive requirement instead of re-solving it.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npx prisma validate` -- expected: schema valid (no schema change this story, but confirms nothing broke).
- `npm run lint` -- expected: clean.
- `npm run dev` + manually: add a Team Member, remove them via the confirm dialog, verify they disappear from the Roster; then verify (e.g. via `npx prisma studio`) the row still exists with `archivedAt` set, not deleted. Also test canceling the dialog (no removal) and attempting to remove an already-archived id (rejected).

## Suggested Review Order

**Domain & infrastructure: the atomic archive fix**

- The check-and-write race is closed here — `updateMany` with `archivedAt: null` in the `where` clause, not a separate list-then-archive.
  [`team-member-repository.ts:14`](../../infrastructure/db/team-member-repository.ts#L14)

- `archiveTeamMember` now trusts `repo.archive`'s `null` return instead of pre-checking via `list()`.
  [`allocation.ts:63`](../../domain/allocation.ts#L63)

- The port signature that makes the atomic contract explicit: `archive` returns `TeamMember | null`, not a bare `TeamMember`.
  [`allocation.ts:14`](../../domain/allocation.ts#L14)

**Server Action**

- Mirrors `addTeamMemberAction`'s error-handling shape from Story 1.2 — same sanitized-error, isolated-revalidate pattern.
  [`team-members.ts:48`](../../app/actions/team-members.ts#L48)

**UI: the confirm dialog, five review fixes live here**

- Start here — `handleConfirm`'s pending-guard and try/catch, both closing real race/crash windows.
  [`remove-team-member-button.tsx:33`](../../app/(pm)/roster/remove-team-member-button.tsx#L33)

- Dialog-dismiss guard while a request is in flight.
  [`remove-team-member-button.tsx:57`](../../app/(pm)/roster/remove-team-member-button.tsx#L57)

- Explicit focus management — Radix's default async focus-restore fights an unmounted trigger, so this overrides it deliberately.
  [`remove-team-member-button.tsx:72`](../../app/(pm)/roster/remove-team-member-button.tsx#L72)

- Reworded confirm copy — no longer implies an undo path that doesn't exist.
  [`remove-team-member-button.tsx:87`](../../app/(pm)/roster/remove-team-member-button.tsx#L87)

**Peripheral**

- Focus target the dialog's `onCloseAutoFocus` hands off to after a successful removal.
  [`page.tsx:10`](../../app/(pm)/roster/page.tsx#L10)

**Results (this pass):**
- `npx tsc --noEmit`, `npx prisma validate`, `npm run lint` — all clean.
- HAPPY_PATH — verified via Playwright: added "Ada Lovelace," confirmed the dialog, member disappeared from the Roster, list reverted to the empty-state copy.
- Cancel path — verified: opened the dialog, clicked Cancel, member remained on the Roster untouched.
- ALREADY_ARCHIVED / NOT_FOUND — verified via a direct call to `archiveTeamMember`: both an already-archived id and a nonexistent id returned `{ok:false, error}` rather than throwing or silently succeeding.
- Soft-delete confirmed via direct DB check: the removed row survives with `archivedAt` set, not physically deleted.

**Flagged during implementation, deferred (pending PM decision on timing):** `npx shadcn init` applied its default "Nova" theme rather than mapping `DESIGN.md`'s actual tokens (purple `#7C5CFF` accent, IBM Plex Mono for data figures, etc.) into `app/globals.css`'s shadcn CSS variables. Not in this story's scope; PM asked to hold this rather than fold it in silently.

**Post-review patch pass:** Verification Gap review found the ALREADY_ARCHIVED/NOT_FOUND checks above were only exercised via a direct call to `archiveTeamMember`, bypassing `removeTeamMemberAction`/`RemoveTeamMemberButton` entirely — the real user-facing failure path had never been driven through the actual UI. Re-verified properly: two browser tabs on the same active Team Member, removed it from tab 1 via the real button/dialog, then clicked Remove on the same (now-archived) member in tab 0 — the dialog correctly stayed open and rendered the inline `role="alert"` "Team member not found or already removed" message. This also required fixing the underlying race: `archiveTeamMember` previously did a `list()`-then-`archive()` check-then-act with a race window (independently flagged by Blind Hunter and Verification Gap); `TeamMemberRepo.archive` is now atomic (`updateMany` with `archivedAt: null` in the `where` clause, returning `null` on no match) so the check and write happen in one DB round trip. 5 additional UI patches applied: try/catch around the action call in the dialog's confirm handler, ignoring dialog-dismiss attempts while a request is pending, a double-click guard, explicit focus management after a successful removal (Radix's default async focus-restore was fighting the unmounted trigger — fixed via `onCloseAutoFocus`), and reworded the confirm dialog's copy to stop implying an undo path that doesn't exist. 5 findings deferred (see `deferred-work.md`): audit trail for who removed a member, a loading state for the roster query, id format validation, client-form validation mirroring the server's limits, and duplicate-name handling (already tracked from Story 1.2). Full Verification section re-run after patching — all commands still pass.
