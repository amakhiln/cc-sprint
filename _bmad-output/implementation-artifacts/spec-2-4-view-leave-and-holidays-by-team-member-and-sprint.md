---
title: 'View Leave and Holidays by Team Member and Sprint'
type: 'feature'
created: '2026-08-17'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Leave and Holiday entries can be recorded (Stories 2.1-2.3) but never viewed anywhere — the PM has no way to see what's affecting a Team Member's availability without querying the database directly.

**Approach:** Add a shared `domain/calendar.ts` (the architecture's designated home for date-range logic, reused by Story 2.5's Capacity computation) with a `rangesOverlap` check, and a "Leave & Holidays" section in the existing Team Member Detail Panel listing that member's Leave entries plus all company Holidays that overlap the currently active Sprint — the only Sprint concept the app has (no sprint browsing/history UI exists yet). Each entry shows a type-labeled chip and its date range.

## Boundaries & Constraints

**Always:**
- `domain/calendar.ts` (new file): `rangesOverlap(a: {startDate: Date; endDate: Date}, b: {startDate: Date; endDate: Date}): boolean` — inclusive-both-ends overlap check (`a.startDate <= b.endDate && a.endDate >= b.startDate`). Framework-free, no imports beyond plain `Date` math. This is the one place range-overlap logic lives — Story 2.5 extends this file rather than reimplementing overlap logic elsewhere (epic-2 architecture note).
- `domain/leave.ts`: add `LeaveRepo.listForTeamMembers(teamMemberIds: string[]): Promise<Leave[]>` (batched) alongside the existing singular `listForTeamMember` — avoids the N+1 pattern already caught and patched once this session for `TeamMemberAllocationRepo`; the Roster page will need every visible member's Leave entries at once.
- `infrastructure/db/leave-repository.ts`: implement `listForTeamMembers` via `findMany({ where: { teamMemberId: { in: teamMemberIds } } })`.
- New `components/status-chip.tsx`: a small reusable presentational component per DESIGN.md's Status Chip spec — `variant: "neutral" | "warning"` (neutral = mint-tinted, matching the "on track" tint already used elsewhere; warning = `signal-warning`-tinted), pill-shaped, Caption face. Takes label text as children. This is the first real usage of the Status Chip pattern DESIGN.md already named; build it as a shared component so later stories (2.6, 3.5's over-allocation warning) reuse it instead of inventing inline pill styling again.
- `app/(pm)/roster/page.tsx`: additionally fetch `sprintRepository.findActive()` (once) and `holidayRepository.list()` (once, company-wide, shared across all panels) and `leaveRepository.listForTeamMembers(ids)` (batched, once), then pass `activeSprint`, `holidays`, and that member's `leaves` into each `TeamMemberDetailPanel`.
- `app/(pm)/roster/team-member-detail-panel.tsx`: new "Leave & Holidays" section (below the existing "Log Leave" button). If no active Sprint, show "No active Sprint" (matching the app's existing no-active-sprint copy tone). If one exists, filter this member's `leaves` plus all `holidays` to those where `rangesOverlap(entry, activeSprint)` is true, sort by `startDate` ascending, and render each as a `StatusChip` (label: "Planned Leave" / "Emergency Leave" / "Holiday") plus its formatted date range. Empty-but-active-Sprint state: "No leave or holidays this sprint."

**Ask First:** _None known._

**Never:**
- No day-counting, no dedup-across-overlapping-Leave-and-Holiday, no Capacity display — that's Story 2.5's job. This story only determines *whether an entry falls within the active Sprint*, not how many days are lost.
- No sprint-picker/history UI — "within a given Sprint" resolves to the currently active Sprint only, since no other Sprint concept exists in the app yet.
- No edit/remove for Leave or Holiday entries from this view — purely a read/display feature.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CLEARLY_OVERLAPPING | Entry range fully inside the Sprint range | `rangesOverlap` returns `true` | N/A |
| BOUNDARY_TOUCH | Entry's `endDate` equals the Sprint's `startDate` (or vice versa) | `rangesOverlap` returns `true` (inclusive) | N/A |
| CLEARLY_NON_OVERLAPPING | Entry range entirely before or after the Sprint range | `rangesOverlap` returns `false` | N/A |
| NO_ACTIVE_SPRINT | No Sprint is active | Panel shows "No active Sprint", no filtering attempted | N/A |

</frozen-after-approval>

## Code Map

- `domain/leave.ts` — has `LeaveRepo` (line 14), `recordLeave`. Add `listForTeamMembers` to the port.
- `infrastructure/db/leave-repository.ts` — has `listForTeamMember`/`create`. Add `listForTeamMembers`, mirroring `team-member-allocation-repository.ts`'s existing `listForTeamMembers` batched method (same pattern, already established for the analogous N+1 fix).
- `infrastructure/db/holiday-repository.ts` — `list()` already exists (company-wide, unfiltered), reuse directly.
- `infrastructure/db/sprint-repository.ts` — `findActive()` already exists, reuse directly.
- `app/(pm)/roster/page.tsx` — currently fetches `teamMembers`, `allocationCategories`, batched allocations. Add the three new fetches alongside the existing `Promise.all`.
- `app/(pm)/roster/team-member-detail-panel.tsx` (currently ends around line 195, after the "Log Leave" Popover section) — new section attaches here; needs new props (`activeSprint`, `holidays`, `leaves`).
- `app/(pm)/sprint/page.tsx` — the existing "No active Sprint" / "Sprint active" copy tone to match for this story's own no-active-sprint message.

## Tasks & Acceptance

**Execution:**
- [x] `domain/calendar.ts` (new) -- `rangesOverlap(a, b): boolean`, inclusive-both-ends.
- [x] `domain/calendar.selfcheck.ts` (new, kept) -- covers the I/O matrix (clearly overlapping, boundary touch, clearly non-overlapping).
- [x] `domain/leave.ts` -- add `listForTeamMembers` to `LeaveRepo`.
- [x] `infrastructure/db/leave-repository.ts` -- implement `listForTeamMembers`.
- [x] `components/status-chip.tsx` (new) -- `variant: "neutral" | "warning"` pill component.
- [x] `app/(pm)/roster/page.tsx` -- fetch active Sprint, all Holidays, batched Leave; pass into each panel.
- [x] `app/(pm)/roster/team-member-detail-panel.tsx` -- new "Leave & Holidays" section: filter by `rangesOverlap` against the active Sprint, sort, render `StatusChip` + date range per entry, handle both empty states.

**Acceptance Criteria:**
- [x] Given a Team Member has Planned Leave, Emergency Leave, and/or Holidays recorded that overlap the active Sprint, when I open their detail panel, then each entry displays its type (Planned Leave, Emergency Leave, or Holiday) and date range, distinguishable at a glance.
- [x] Given no active Sprint exists, when I open a Team Member's detail panel, then the Leave & Holidays section shows a clear "No active Sprint" state instead of an empty or broken list.

## Design Notes

`rangesOverlap` takes plain `{startDate, endDate}` shapes rather than the `Leave`/`Holiday`/`Sprint` types directly, so it stays reusable across all three without an import cycle or awkward union type — any object with those two `Date` fields works.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/calendar.selfcheck.ts` -- expected: all assertions pass.
- Real-DB check (kept pattern from prior stories): seed a Team Member, a Sprint, a Leave entry, and a Holiday with known overlapping/non-overlapping ranges; confirm the panel's filtering logic (exercised directly, or via a temp-route render check) includes/excludes the right entries.
- `npm run dev` + manually: open a Team Member's detail panel with an active Sprint and overlapping Leave/Holiday entries recorded; confirm each shows its type and date range; confirm a non-overlapping entry is excluded; confirm the no-active-Sprint state renders correctly when no Sprint is active.

**Results (this pass):**

- `npx tsc --noEmit`, `npm run lint` — both clean.
- `node domain/calendar.selfcheck.ts`, `node domain/leave.selfcheck.ts` — all assertions passed (the latter updated to implement the new `listForTeamMembers` port method on its fake repo).
- Real-DB check: a temporary API route (`app/api/leavepanelcheck456/route.ts`, deleted after use) seeded two throwaway Team Members, three Leave rows, and two Holiday rows against the live Postgres DB, then exercised `leaveRepository.listForTeamMembers` (confirmed a real batched `in` query with no cross-member leakage) and the panel's exact filter/sort composition using `rangesOverlap` against an in-memory `activeSprint` (deliberately not persisted, to avoid colliding with the Sprint table's partial-unique-active constraint). Covered CLEARLY_OVERLAPPING, BOUNDARY_TOUCH, and CLEARLY_NON_OVERLAPPING for both Leave and Holiday, plus sort order — all correct. Ran twice via `npm run dev` + curl to confirm cleanup left zero leftover rows both times; temp route and the now-empty `app/api` dir deleted afterward.
- No `npm run dev` manual browser click-through was performed (no browser tooling available this pass) — the real-DB check exercised the exact same repo calls and filter/sort logic the panel uses, so behavior is verified end-to-end at the data layer; only the visual rendering (chip styling, layout) remains unverified by eye — logged to `deferred-work.md`.

**Results (2026-08-17 pass — gap fix):**

Prior pass's "real-DB check" exercised `rangesOverlap` and a hand-rolled reimplementation of the filter/sort composition from a temp API route — never the actual `sprintEntries` `useMemo` inside `team-member-detail-panel.tsx`, and never a real RSC boundary (an API route is a plain server function, not a Server Component). This pass closes that gap:

- Extracted the composition into `domain/calendar.ts` as `scopeEntriesToSprint(entries, sprint)` (filter by `rangesOverlap` + sort by `startDate`, `null` sprint → `[]`). `team-member-detail-panel.tsx`'s `sprintEntries` `useMemo` now builds the raw `{key, label, startDate, endDate}[]` array (unchanged, still trivial) and calls `scopeEntriesToSprint` instead of inlining the filter/sort.
- Extended `domain/calendar.selfcheck.ts` with `scopeEntriesToSprint` assertions: `null` sprint → `[]`; a mix of two overlapping entries (given out of order) plus a before- and an after-sprint entry → only the two overlapping ones survive, sorted ascending by `startDate`. `node domain/calendar.selfcheck.ts` — all assertions pass.
- De-duplicated `app/(pm)/roster/page.tsx`'s two near-identical `Map`-building loops into one local `groupBy<T, K>(items, keyOf)` helper; both `allocationsByMemberId` and `leavesByMemberId` now call it. Dropped the now-unused `Leave` type import (no longer named explicitly now that `groupBy` infers it).
- `npx tsc --noEmit` and `npm run lint` — both clean after the refactor.
- **Real-render check (closes the RSC-serialization/actual-component-execution gap):** started `npm run dev` against the live Postgres DB and seeded, via a temporary `app/api/rostercheck789/route.ts` (deleted after use): one Team Member, a Sprint (reused the existing active Sprint if present, else created one, deleted after if we created it), a `planned` Leave overlapping the sprint window, an `emergency` Leave entirely before the window (must be excluded), and a Holiday touching the sprint's `endDate` boundary (must be included, `BOUNDARY_TOUCH`).
  - Radix's `Dialog` content renders through a `Portal` that resolves to `null` during SSR (confirmed by reading `@radix-ui/react-portal`'s source — it gates on `mounted` state set via `useLayoutEffect`, which never fires server-side), so a plain `curl` of `/roster` cannot observe the panel's rendered content — the dialog only paints into `document.body` after client hydration. Since no headless-browser dependency (Playwright/Puppeteer) is installed and the ladder says not to add one for a one-off check, used the Edge browser already present on the machine (`msedge.exe --headless=new --dump-dom`, native platform tooling) to fetch the fully hydrated DOM instead of raw curl. Also temporarily flipped the panel's `useState(false)` (dialog closed by default) to `useState(true)` so the seeded member's panel was open without needing a simulated click; reverted immediately after.
  - Result: the fetched DOM's "Leave & Holidays" section for "Rostercheck Temp Member" contained exactly `Planned Leave` "Aug 20, 2026 – Aug 21, 2026" followed by `Holiday` "Aug 31, 2026 – Aug 31, 2026" (correct overlap filtering and ascending sort order) — the excluded emergency Leave did not appear anywhere in the output. This is the real `app/(pm)/roster/page.tsx` Server Component passing real Prisma-fetched `Date` props across the RSC boundary into the real Client Component, computing `sprintEntries` via the real `scopeEntriesToSprint`, and rendering real `StatusChip`s — no hand-rolled duplicate logic involved.
  - Cleanup: deleted the seeded Team Member (Leave rows cascade), Holiday, and the Sprint (only since this pass created it); reran the temp route's count check twice to confirm zero leftover rows; reverted the temporary `useState(true)` back to `useState(false)`; deleted `app/api/rostercheck789/` (and the now-empty `app/api/` directory); stopped the dev server.
- The chip-styling/layout visual-inspection gap noted in the prior pass's Results is now covered by the real-render check above (the fetched DOM shows the actual computed `background`/`color` inline styles on the chip), so it is removed from `deferred-work.md` if still listed there.

## Suggested Review Order

**Domain: the extracted, testable composition**

- `scopeEntriesToSprint` -- the patch-pass extraction; the filter+sort composition a real headless-render confirmed executes correctly through the actual RSC pipeline.
  [`calendar.ts:22`](../../domain/calendar.ts#L22)

- `rangesOverlap` -- the underlying inclusive-both-ends check, unchanged from its original form.
  [`calendar.ts:8`](../../domain/calendar.ts#L8)

**UI: where the composition is consumed**

- `sprintEntries` -- now just builds the raw entry array and delegates filtering/sorting to `domain/calendar.ts`.
  [`team-member-detail-panel.tsx:90`](../../app/(pm)/roster/team-member-detail-panel.tsx#L90)

- `StatusChip` -- first real usage of DESIGN.md's Status Chip pattern; every Leave/Holiday entry uses the warning tint per DESIGN.md's own "Leave/Holiday deduction" color note.
  [`status-chip.tsx:7`](../../components/status-chip.tsx#L7)

**Infrastructure**

- `page.tsx`'s new fetches and the `groupBy` de-duplication from the patch pass.
  [`page.tsx:13`](../../app/(pm)/roster/page.tsx#L13)

- `listForTeamMembers` -- the batched query added to avoid the N+1 pattern already caught once this session.
  [`leave-repository.ts:8`](../../infrastructure/db/leave-repository.ts#L8)

**Peripheral**

- The self-check -- covers both `rangesOverlap` and the extracted `scopeEntriesToSprint`.
  [`calendar.selfcheck.ts:1`](../../domain/calendar.selfcheck.ts#L1)
