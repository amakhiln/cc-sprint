---
title: 'View Allocated Hours Breakdown'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.5 shows one headline Capacity number (Dev-allocated hours only), but a PM can't see how a Team Member's — or the team's — Sprint hours split across every Allocation Category (Dev vs. Management vs. DevOps, etc.), which is FR13's explicit ask and the PRD's own worked correctness fix (Leave/Holiday must reduce every category, not just Dev).

**Approach:** Add `domain/capacity.ts` functions that reuse the existing Story 2.5 formula per-category (same day-loss deduction applied uniformly, never recomputed independently — AD-1) to produce a per-member breakdown and a team-wide per-category total. Reveal it via a native `<details>/<summary>` disclosure on the existing `CapacityLedger` (EXPERIENCE.md: "select/expand reveals this breakdown") — no new page, no client-side state.

## Boundaries & Constraints

**Always:**
- `domain/capacity.ts`: `computeAllocationBreakdown({workingHoursPerDay, categoryIds, allocations, sprint, leaves, holidays}): {categoryId: string; hours: number}[]` — for each `categoryId`, resolve that member's percent from `allocations` (0 if no row), call the existing `computeTeamMemberCapacityHours` (same Leave/Holiday day-loss logic, applied per category exactly as it already is for Dev — never a second formula). Framework-free, no category-name lookup (that's a display concern).
- `domain/capacity.ts`: `sumAllocationBreakdown(perMember: {categoryId: string; hours: number}[][]): {categoryId: string; hours: number}[]` — sums `hours` per `categoryId` across every member's breakdown, rounded (mirrors `sumCapacityHours`'s role but keyed by category instead of one total).
- `components/capacity-ledger.tsx`: new optional prop `breakdown?: {categoryId: string; categoryName: string; hours: number}[]`. When present and non-empty, render a `<details><summary>Breakdown</summary>` block below the existing bar listing each category's name and hours (Data Figure face, right-aligned per DESIGN.md). No prop, or an empty array, renders exactly as Story 2.5 left it — no `<details>` at all.
- `app/(pm)/roster/page.tsx`: inside the existing `devCategory && activeSprint` gate (unchanged from Story 2.5 — the breakdown is a sub-feature of the same Ledger, inheriting its "no Dev category"/"no active Sprint" empty states), compute each member's breakdown via `computeAllocationBreakdown` (categoryIds = every `allocationCategories` id) and the team-wide totals via `sumAllocationBreakdown`; map `categoryId` → `categoryName` before passing to `CapacityLedger`.

**Ask First:** _None known._

**Never:**
- No new page, route, or Sprint Plan Overview preview — same interim-Roster placement as Story 2.5.
- No client-side expand/collapse state — the native `<details>` element provides this for free, keyboard-accessible, no `"use client"` needed.
- No changes to `computeTeamMemberCapacityHours`'s existing signature, return field names, or Story 2.5's callers — this story only adds new functions that call it, never modifies it.
- No per-category bar/segment visualization (the multi-color segmented bar DESIGN.md originally described) — a plain hours list per category satisfies FR13; visual segments are a polish item, not required by this story's ACs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| UNIFORM_DEDUCTION | A member has Dev 60%, Management 30%, DevOps 10%, plus 1 Leave day, in a 10-working-day Sprint at 8h/day | Each category's hours reduce by that day's own percent-scaled hours (e.g. Dev -4.8h, Management -2.4h, DevOps -0.8h) — not skipped for non-Dev categories | N/A |
| NO_ROW_FOR_CATEGORY | A member has no allocation row for a given category | That category shows 0 hours in the breakdown, not omitted from the list | N/A |
| TEAM_WIDE_PER_CATEGORY_TOTAL | Two members' breakdowns, each with different per-category hours | The team-wide total for each category equals the sum of just that category's hours across both members (no cross-category mixing) | N/A |

</frozen-after-approval>

## Code Map

- `domain/capacity.ts:21` `computeTeamMemberCapacityHours` — the formula this story reuses per category, unchanged.
- `domain/capacity.ts:48` `computeCapacityForTeam` — existing per-member join pattern (Dev-only) to mirror for `computeAllocationBreakdown`.
- `domain/capacity.ts:85` `sumCapacityHours` — existing single-total aggregator pattern to mirror for `sumAllocationBreakdown`.
- `components/capacity-ledger.tsx:8` `CapacityLedger` — add the optional `breakdown` prop and `<details>` block; existing headline/bar JSX unchanged.
- `app/(pm)/roster/page.tsx:49` the `devCategory && activeSprint` gate — compute and thread breakdown data through here, alongside the existing `computeCapacityForTeam`/`sumCapacityHours` calls.

## Tasks & Acceptance

**Execution:**
- [x] `domain/capacity.ts` -- `computeAllocationBreakdown`, `sumAllocationBreakdown`.
- [x] `domain/capacity.selfcheck.ts` -- extend with UNIFORM_DEDUCTION, NO_ROW_FOR_CATEGORY, TEAM_WIDE_PER_CATEGORY_TOTAL.
- [x] `components/capacity-ledger.tsx` -- optional `breakdown` prop, `<details>/<summary>` disclosure.
- [x] `app/(pm)/roster/page.tsx` -- compute per-member and team-wide breakdowns, map category names, pass into both `CapacityLedger` instances.

**Acceptance Criteria:**
- Given a Team Member with multiple Allocation Categories, when I expand their row's Capacity Ledger, then I see hours per category with the same Leave/Holiday reduction visible in the headline figure applied to every category, not only Dev.
- Given the team-wide Ledger, when I expand it, then I see a team-wide total per category.

## Design Notes

`computeAllocationBreakdown` deliberately calls `computeTeamMemberCapacityHours` once per category rather than sharing a single day-loss computation across categories — the day-loss count itself doesn't depend on category, so this is a few redundant (cheap) calls, not a correctness risk, and keeps Story 2.5's already-reviewed function untouched rather than refactoring it to return a multi-category shape.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/capacity.selfcheck.ts` -- expected: all assertions pass, including the three new I/O matrix cases.
- Real-DB check (kept pattern from prior stories): seed a Team Member with 2+ category allocations and a Leave entry; confirm `computeAllocationBreakdown`'s per-category output against hand-computed values.
- `npm run dev` + manually: expand a row's Ledger and the team-wide Ledger; confirm the breakdown lists every category with sensible hours, and collapses/expands via keyboard (`<details>` native behavior).

**Manual checks (if no CLI):**
- Visual check of the breakdown list against DESIGN.md's Data Figure convention (Display face, right-aligned).

**Results (2026-08-19 pass):**

- `npx tsc --noEmit`, `npm run lint` -- both clean.
- `node domain/calendar.selfcheck.ts`, `node domain/capacity.selfcheck.ts` -- all assertions passed, including UNIFORM_DEDUCTION, NO_ROW_FOR_CATEGORY, and TEAM_WIDE_PER_CATEGORY_TOTAL (the three I/O matrix rows -- Matrix Test Audit satisfied, no gaps).
- The implementer's sandbox had no reachable dev server/DB, so the real-DB and manual checks were performed in this pass instead: seeded a real Team Member (9h/day) with Support (marked Dev) at 60% and a second category at 40%, plus 1 Leave day inside a real 10-working-day Sprint, all against the live Supabase DB. Curled `/roster`'s server-rendered HTML directly and confirmed the `<details><summary>Breakdown</summary>` disclosure lists both categories with hand-computed values -- Support 48.6h (54 - 5.4), the second category 32.4h (36 - 3.6) -- in both the team-wide and per-row Ledger instances. Fixtures reverted afterward; confirmed zero leftover active Sprints.

**Results (2026-08-19 review-patch pass):**

Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) ran against the diff. Patched:

- `domain/capacity.selfcheck.ts` -- added `DEV_ROW_MATCHES_HEADLINE` (pins `computeAllocationBreakdown`'s Dev-category row to `computeTeamMemberCapacityHours`'s figure for the same inputs, so the two independent call paths can't silently drift), plus Holiday-only and zero-working-day-Sprint cases through the breakdown path (previously only asserted through the single-value formula).
- `domain/capacity.ts` -- `sumCapacityHours` now rounds its summed total (it didn't), matching `sumAllocationBreakdown`'s contract.
- `components/capacity-ledger.tsx` / `app/(pm)/roster/page.tsx` -- every `<details>` disclosure previously shared the identical "Breakdown" accessible name; added a `breakdownLabel` prop ("Team Breakdown" / "Breakdown for {name}") so screen-reader users can distinguish which Ledger's disclosure they're in. Also added `truncate`/`min-w-0` to the category-name column so a long category name can't crowd the hours figure.
- **Real verification-gap fix:** the Verification Gap layer correctly identified that the prior pass's real-DB check used only one Team Member, so it never actually distinguished "team-wide total" from "that one member's own breakdown" -- a swapped-props bug would have passed undetected. Re-ran the real-DB check with two real Team Members with different per-category allocations: team-wide showed Support 134.0h/Mgmt 36.0h, exactly the sum of Akhil's 54.0h/36.0h and a second member's 80.0h/0.0h -- confirming the team-wide and per-row Ledger instances are wired to the correct, distinct data sources, and the new `breakdownLabel`s rendered correctly distinct ("Team Breakdown", "Breakdown for Akhil Narayanan", "Breakdown for Multicheck Second Member").

Deferred (see `deferred-work.md`): the pre-existing two-`Promise.all` TOCTOU window in `page.tsx` (not caused by this story); the `<details>` disclosure's baseline-only styling (no deeper DESIGN.md glass/accent tie-in); no visual indicator connecting the breakdown list to which category is "Dev".

Rejected as noise or out of scope: discarding `fullDevHours` per category in `CategoryHours` (explicitly out of scope per this spec's Never clause -- no per-category bar is required); the `?? 0`/`?? []` join fallbacks (same already-rejected "required by TypeScript's Map typing" class from Story 2.5's review); persisting the breakdown into `Sprint.snapshotAllocationBreakdown` (Epic 4's Close Sprint job, not this story's); redundant per-category day-loss recomputation and linear category lookup (both already an explicit, documented tradeoff in this spec's own Design Notes); an empty team rendering no breakdown disclosure (correct behavior, not a bug); no input validation on `devPercent`/`workingHoursPerDay`/date ranges and duplicate-categoryId rows (unreachable via any real caller -- upstream writes already validate, and `TeamMemberAllocation`'s `@@unique([teamMemberId, categoryId])` constraint makes duplicates impossible at the DB level); an allocation row referencing a category absent from `categoryIds` (unreachable -- `removeAllocationCategory`'s `isCategoryInUse` guard plus `onDelete: Restrict` prevent a category from disappearing while allocated); a `Promise.all` rejection "crashing" the page (already caught by the existing `app/(pm)/roster/error.tsx` boundary); more than one category ever having `isDev: true` (already prevented by the `AllocationCategory_one_dev_idx` partial unique index); no script auto-running `capacity.selfcheck.ts` (the same standing no-CI deferral already logged since Story 1.1, not re-logged here).

Re-ran `npx tsc --noEmit`, `npm run lint`, `node domain/calendar.selfcheck.ts`, `node domain/capacity.selfcheck.ts` -- all clean/passing after patches.

## Suggested Review Order

**Domain: the per-category formula and its consistency guarantee**

- `computeAllocationBreakdown` -- reuses `computeTeamMemberCapacityHours` per category rather than a second formula, so Leave/Holiday deduction is provably uniform.
  [`capacity.ts:107`](../../domain/capacity.ts#L107)

- `DEV_ROW_MATCHES_HEADLINE` -- the review-patch self-check pinning the breakdown's Dev row to the headline figure, so the two call paths can't silently drift.
  [`capacity.selfcheck.ts:165`](../../domain/capacity.selfcheck.ts#L165)

- `sumAllocationBreakdown` -- team-wide per-category total; `sumCapacityHours` -- the review-patch rounding fix for consistency.
  [`capacity.ts:137`](../../domain/capacity.ts#L137)
  [`capacity.ts:85`](../../domain/capacity.ts#L85)

**UI: revealing the breakdown**

- `CapacityLedger`'s `<details>` disclosure -- native, no client state; the review-patch `breakdownLabel` prop gives each disclosure a distinct accessible name.
  [`capacity-ledger.tsx:8`](../../components/capacity-ledger.tsx#L8)

- `RosterPage`'s breakdown computation and the two `CapacityLedger` call sites -- re-verified with two real Team Members to confirm team-wide vs. per-row wiring is correct and distinct, not swapped.
  [`page.tsx:74`](../../app/(pm)/roster/page.tsx#L74)

**Peripheral**

- The self-check -- covers the I/O matrix (uniform deduction, missing allocation row, team-wide sum) plus the review-patch additions (headline consistency, Holiday-only, zero-working-day Sprint).
  [`capacity.selfcheck.ts:1`](../../domain/capacity.selfcheck.ts#L1)
