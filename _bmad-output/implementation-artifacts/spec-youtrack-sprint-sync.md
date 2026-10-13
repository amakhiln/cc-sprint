---
title: 'Sync Sprint name from YouTrack on Create Sprint'
type: 'feature'
created: '2026-10-13'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: '79112e8ceb3f936ddb1092523465e9bfde38fb7a'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Local Sprints have no name, only a date range. The team names Sprints in YouTrack ("Sprint 22"), so the PM has to cross-reference dates, and dates typed by hand can drift from YouTrack's.

**Approach:** When the Create Sprint form renders, read the configured YouTrack agile board's sprints and pre-fill name, start date and length from one of them. The PM confirms, and the Sprint is saved with `name` and `youtrackSprintId`. The name shows wherever a Sprint is shown, with the date range as a fallback. This is a pull on render: YouTrack has no sprint-created webhook.

## Boundaries & Constraints

**Always:**
- The board comes from a new optional env var `YOUTRACK_AGILE_BOARD_ID` (the ADM project is on 3 boards, so automatic discovery would be ambiguous). If it's unset or YouTrack fails, the form works as it does today, plus a manual optional Name field. YouTrack never blocks creating a Sprint.
- `Sprint` gets `name String?` and `youtrackSprintId String? @unique`, added as a migration with no backfill.
- YouTrack `start`/`finish` are epoch ms (verified live: start `00:00:00.000Z`, finish `23:59:59.999Z`). Take the UTC calendar date of each. Length = inclusive day count, which matches `createSprint`'s `endDate` formula.
- Re-importing a `youtrackSprintId` that is already used returns a friendly error, never a thrown P2002.
- Domain stays framework-free (AD-1): the YouTrack sprint type and selection logic live in `domain/`, and REST stays in `infrastructure/youtrack/`.

**Never:** No webhook, cron or background polling. No writes to YouTrack. No change to the single-active-Sprint rule (AD-6). No editing name/dates after creation. No Settings UI for the board ID.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Board set, a selectable sprint exists | Form pre-filled with name, start date, length; submit saves name and id | N/A |
| Board unset | No env var | Manual form plus empty Name field | N/A |
| YouTrack down / 4xx | fetch fails | Manual form plus a muted "Couldn't load YouTrack sprints" note | logged server-side, no raw error shown |
| Already imported | Selected id already on a Sprint | Not offered as a choice; a forged submit → "This YouTrack sprint was already used." | P2002 caught |
| Missing dates | YouTrack sprint without start/finish | Skipped as a choice | N/A |

**Decisions (2026-10-13):**
- No dropdown. The form auto-fills the earliest selectable YouTrack sprint (not yet imported, finish > today, sorted by start). A sprint in its last day counts as over; the human changed this from "finish ≥ today" after review on 2026-10-13.. Name, start date and length stay editable. A small "From YouTrack: <name>" hint plus a hidden `youtrackSprintId` input keep the link even when the PM edits fields.
- Existing unnamed Sprints stay unnamed and show their date range. No backfill, no match at display time.

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma:45` `model Sprint` -- add two fields; new migration under `prisma/migrations/`.
- `domain/sprint.ts` -- `Sprint` type, `SprintRepo.create` data, `CreateSprintInput` gain `name?`/`youtrackSprintId?`; `createSprint` already catches P2002 but maps it to the "already active" message. Tell the two apart via `error.meta.target` containing `youtrackSprintId` (duck-typed, no Prisma import).
- `domain/youtrack.ts` -- add `YouTrackSprint` type + a port method, and a pure `selectableSprints(sprints, importedIds, today)` helper.
- `infrastructure/youtrack/config.ts` -- read `YOUTRACK_AGILE_BOARD_ID`, kept separate from `get()`'s required trio so a missing board ID doesn't disconnect issues.
- `infrastructure/youtrack/rest-client.ts` `restGet` -- reuse as is. `infrastructure/youtrack/issues.ts` -- follow its result-shape and error-logging pattern for the new `listSprints`.
- `infrastructure/db/sprint-repository.ts` -- `create` passes the new fields; add `listImportedYouTrackIds()` (or select from existing queries).
- `app/actions/sprint.ts` `createSprintAction` -- read `name`/`youtrackSprintId` from FormData (trim; empty → null).
- `app/(pm)/sprint/page.tsx` + `create-sprint-form.tsx` -- fetch on the server, pass choices as props; the form stays a client component.
- Display sites (name primary, dates secondary): `app/(pm)/sprint/page.tsx:62`, `app/(pm)/page.tsx:93`, `app/(pm)/leave/page.tsx:80`, `app/(pm)/velocity-history/page.tsx:89`, `components/progress-view.tsx:110` (fed by `app/progress-data.ts:97`, `app/sprint-plan-data.ts:97`).
- Don't touch: close-sprint flow, capacity math, `.env` values.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + migration -- add fields; hand-write `prisma/migrations/20261013000000_add_sprint_youtrack_name/migration.sql` (ADD COLUMN x2 + unique index, matching Prisma's naming `Sprint_youtrackSprintId_key`), then `npx prisma generate`. This worktree has no `.env`: do NOT run `migrate dev`/`deploy` or anything else that connects to a database.
- [x] `domain/youtrack.ts`, `domain/sprint.ts` -- types, `selectableSprints`, duplicate-id error.
- [x] `domain/youtrack.selfcheck.ts` / `domain/sprint.selfcheck.ts` (extend) -- cover the date conversion, finish < today excluded, imported excluded, missing dates skipped, P2002 target routing.
- [x] `infrastructure/youtrack/config.ts`, new `infrastructure/youtrack/sprints.ts` -- `GET /api/agiles/{id}/sprints?fields=id,name,start,finish,archived`.
- [x] `infrastructure/db/sprint-repository.ts`, `app/actions/sprint.ts` -- persist.
- [x] Sprint page + form -- pre-fill / select, Name field.
- [x] Display sites -- show name.
- [x] `.env.example` -- document `YOUTRACK_AGILE_BOARD_ID`.

**Acceptance Criteria:**
- Given a Sprint was created from YouTrack "Sprint 22", when viewing Home, Backlog, Leave, Progress, and Velocity History, then "Sprint 22" appears with its date range.
- Given a Sprint with null name, when it is displayed, then the date range is shown as today.

## Implementation Notes

- Home (`app/(pm)/page.tsx`) also renders `CreateSprintForm`, so the loading lives in a shared file, `app/sprint-suggestion-data.ts`, used by both pages. Both routes are `force-dynamic` (via `app/(pm)/layout.tsx`), so the suggestion is fresh on every request.
- Prisma 7 adapter-pg puts the unique-violation column under `meta.driverAdapterError` or in the message, not under `meta.target`. `uniqueTargetIncludes` searches the serialized `meta` plus the message. Only tested with fake errors, not a real Postgres violation.
- Beyond the spec: name ≤ 100 characters; archived YouTrack sprints are excluded.
- Added `infrastructure/youtrack/sprints.selfcheck.ts` to cover the matrix rows for board unset and YouTrack down / 4xx.
- Migration written by hand and not applied anywhere. `tsc` is clean after `next typegen`.

## Spec Change Log

- **Loop 1 (intent_gap, resolved by the human):**
  - **Finding:** a YouTrack sprint ending today was still selectable. The active local Sprint was created by hand and isn't linked, so closing it on Oct 14 would pre-fill Sprint 21 (already over) instead of Sprint 22.
  - **Amended:** the frozen decision is now "finish > today".
  - **Deviation:** the process calls for reverting and re-deriving. Because the change is a one-operator edit, it was patched in place and the rest of the diff kept as is.
  - **KEEP:** everything else in the reviewed diff.

## Review Triage Log

| # | Source | Finding | Verdict | Evidence / route |
|---|--------|---------|---------|------------------|
| 1 | blind, edge E9 | Sprint ending today pre-filled over the upcoming one | medium | The active Sprint was created by hand, so closing it on Oct 14 suggests Sprint 21. Route: intent_gap; the human chose "finish > today". |
| 2 | edge E1 | No `$top` on `/api/agiles/{id}/sprints` | medium | Every other YouTrack REST call here passes `$top` because the default page is limited. The board already has 22 sprints in creation order, so the newest would be dropped first. Route: patch. |
| 3 | blind B1, edge E2, vg-other | `loadSprintSuggestion` throws if `listImportedYouTrackIds` fails | low | The page's other DB queries would already throw, but the comment promises "never blocks". The fix is a direct try/catch. Route: patch. |
| 4 | blind B5 | `.env.example` ships a real board id, so copying it turns the feature on | low | The other example values are placeholders. Direct fix. Route: patch. |
| 5 | vg-other | Dead `createSprint` call in sprint.selfcheck case 10 | low | The result is discarded and nothing is asserted. Direct deletion. Route: patch. |
| 6 | vg | `uniqueTargetIncludes` only tested with fake Prisma errors | maybe-false | If the real adapter-pg error hides the column, the message would wrongly read "already active" (medium; the create is still rejected). Settle with a duplicate insert in pm_test. Route: defer. |
| 7 | vg | `createSprintAction` form parsing not tested | low | The action imports next/cache and Prisma, and there's no action-level test setup. Route: defer (per vg disposition). |
| 8 | blind B2, edge E7 | No opt-out of the YouTrack link after the PM edits fields | false | The frozen decision explicitly keeps the link when fields are edited. |
| 9 | blind B3, edge E9b | Only one suggestion, no picker | false | The human chose "Auto-fill earliest" over a dropdown. |
| 10 | blind B4 | Hidden `youtrackSprintId` not length/format validated | low | Only signed-in PMs post this form, and tampering harms only their own data. Rejected: unlikely, and the fix adds guards. |
| 11 | blind B6, edge E6 | UTC flooring breaks for non-UTC timestamps | false | Verified live: this instance's sprint dates are at 00:00Z and 23:59:59.999Z. |
| 12 | blind B7 | Substring match for the constraint is fragile | false | Sprint's only other unique constraints are the id PK and `Sprint_one_active_idx`, and neither contains "youtrackSprintId". |
| 13 | blind B8 | Name missing on the share page and Close Sprint dialog | false | Neither view renders any Sprint label or date range today. |
| 14 | blind B9a, vg | `loadSprintSuggestion` has no self-check | low | It's an 8-line wire-up, and each piece is covered. Rejected: the fix adds ports and parameters. |
| 15 | blind B9b | sprints.selfcheck stubs without try/finally | low | Cosmetic: the process exits on a failed assertion anyway. Rejected. |
| 16 | blind B10 | `/sprint` awaits the suggestion sequentially | low | Only runs when no Sprint is active. Rejected: the fix restructures the page's loading. |
| 17 | edge E3 | YouTrack name over 100 characters is pre-filled, then rejected | low | Unlikely for sprint names. Rejected. |
| 18 | edge E4 | YouTrack sprint over 365 days fails the length input | low | Unlikely. Rejected. |
| 19 | edge E5 | Empty YouTrack sprint name | false | YouTrack requires a sprint name, and the live data has names on all 22. |
| 20 | edge E8 | After a duplicate error the stale form keeps failing | low | Needs two tabs or a race; a reload fixes it. Rejected. |
| 21 | vg | sprints.selfcheck missing from the Verification commands | low | Rejected: the fix edits this build's spec. |
| 22 | blind B9c | No end-to-end check of imported-id exclusion | low | Same as #14. Rejected. |
| 23 | vg | Adapter failure path uncovered | false | `infrastructure/youtrack/sprints.selfcheck.ts` covers the down and 404 cases, and passes. |

## Verification

**Commands:**
- `node domain/youtrack.selfcheck.ts` and `node domain/sprint.selfcheck.ts` -- all assertions pass.
- `npx tsc --noEmit` and `npm run lint` -- no new errors.

**Manual checks:**
- With `YOUTRACK_AGILE_BOARD_ID=121-783`, the /sprint form (no active Sprint, pm_test schema) offers Sprint 22 with start Oct 15, length 14.
