# Epic 2 Context: Leave, Holidays & Capacity Calculation

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic turns the roster/allocation/sprint foundation from Epic 1 into a real, trustworthy Capacity number: the PM records Planned Leave, Emergency Leave, and company Holidays, and the system computes each Team Member's available hours for the current Sprint — accounting for their Working Hours, Allocation %, and time lost to Leave/Holiday, with no double-counting of overlapping days or weekends. This is the product's core value proposition ("capacity made visible").

## Stories

- Story 2.1: Record Planned Leave
- Story 2.2: Record Emergency Leave
- Story 2.3: Record Holiday / Office Closure
- Story 2.4: View Leave and Holidays by Team Member and Sprint
- Story 2.5: Compute Sprint Capacity (Per-Person and Team Total)
- Story 2.6: View Allocated Hours Breakdown

## Requirements & Constraints

- A PM can enter a date range of Planned Leave for a Team Member, affecting whichever Sprint(s) that range overlaps — Leave is not tied to one Sprint by reference (see Technical Decisions).
- Emergency Leave can be entered at any point, including mid-Sprint, and must be reflected immediately (no separate "review before save" step).
- A Holiday is company-wide (applies to every Team Member at once) — not entered per person, and also not tied to one Sprint by reference.
- Capacity computation must reduce a Team Member's hours by distinct working days lost to Leave and/or Holiday — a day covered by both a Leave range and a Holiday counts once, not twice; weekend/non-working days are never counted as lost (they were never available).
- A Team Member's Sprint Capacity = Sprint working days × Working Hours/day × Dev Allocation % − hours lost to Leave/Holiday (applied uniformly across all Allocation Categories, not just Dev, when computing the per-category breakdown in Story 2.6).
- Team-wide Capacity is the sum of every Team Member's individual Capacity.
- Dates operate at day granularity everywhere, ranges inclusive on both ends (established in Epic 1).

## Technical Decisions

- **Data model** (Architecture Spine ERD): `Leave { id, teamMemberId, type, startDate, endDate }` — `type` distinguishes Planned vs Emergency (use a Prisma enum, `LeaveType`, matching the established convention from `Sprint.status`/`SprintStatus`, even though the ERD notates it as a plain string). **No `sprintId` field** — like `Holiday`, a Leave entry is evaluated against whichever Sprint's date range it falls within at Capacity-computation time, not tied to one Sprint by reference. `Holiday { id, startDate, endDate }` — also no Sprint foreign key, for the same reason.
- **Shared domain logic requirement**: date-range/working-day/overlap calculations must live in one shared `domain/calendar.ts`, used by both Leave/Holiday-driven Capacity deduction and the Capacity figure itself — never reimplemented per call site. This module doesn't exist yet; the first story that actually needs day-counting/overlap logic (Story 2.5, possibly 2.3 for Holiday's own overlap-with-existing-Holidays question) should create it. Stories 2.1/2.2 (recording Leave) don't need it — they're a straightforward validated write, no day-counting involved yet.
- `domain/capacity.ts` (doesn't exist yet, Story 2.5+) will export one shared `AllocationBreakdown` type used by both the Capacity figure (FR11/12) and the FR13/Story 2.6 per-category breakdown view.
- Same hexagonal conventions as Epic 1: one repo/port per aggregate (`LeaveRepo`, `HolidayRepo` will be separate from each other and from `TeamMemberRepo`/`SprintRepo`), discriminated `{ok,data}`/`{ok:false,error}` results, atomic repo-level not-found/guard patterns established in Epic 1 (`update()`+catch-`P2025` as the default; `updateMany`+count+refetch specifically when an additional non-unique filter condition must be enforced atomically, as in Story 1.6's archived-member guard).

## UX & Interaction Patterns

- **Leave Entry** (EXPERIENCE.md Component Patterns): a small form reached from the Team Member Detail Panel's "Log Leave" action — a date range picker and a Planned/Emergency toggle (FR6/FR7). Saving applies immediately, no review step. The mockup (`key-team-member-detail.html`, pre-dates the Aurora Light rework) shows it as a popover; DESIGN.md's current identity applies universal glassmorphism, so no special-casing is needed for this surface specifically anymore.
- **Team Member Detail Panel** (already built, Stories 1.5/1.6): currently has Working Hours + Allocation % editor + one combined Save. This epic adds a "Log Leave" action/button to that same panel, opening the Leave Entry form as an independent, separately-submitted action — not bundled into the panel's existing Save.
- **Holiday Manager** (Story 2.3, EXPERIENCE.md): lives in Settings (a section that doesn't exist yet), not per-Team-Member — a list of existing Holidays plus an add-date-range control.
- **Status Chip**: one per Leave type (Planned/Emergency) and Holiday, used starting in Story 2.4's list view — neutral tint for informational Leave/Holiday tags (DESIGN.md's Aurora Light Status Chip component already defined, mint-tinted for positive/neutral, `signal-warning` for anything advisory).
- **Capacity Ledger** (Story 2.5+): the product's signature element, not yet built — don't build any part of it speculatively in earlier stories of this epic.

## Cross-Story Dependencies

- Story 2.1 (Planned Leave) and 2.2 (Emergency Leave) both write to the same `Leave` model/domain function, differing only in `type` and (per FR7) the immediacy expectation once Capacity computation exists — 2.2 is expected to be a thin story once 2.1 lands the general mechanism.
- Story 2.4 (view Leave/Holidays) needs a Sprint's date range to scope "entries within a given Sprint" — depends on Sprint existing (Epic 1, done) but doesn't depend on 2.1-2.3 being UI-complete, just on `Leave`/`Holiday` rows existing to query.
- Story 2.5 (Capacity computation) depends on 2.1-2.3 (Leave/Holiday data to deduct) and Epic 1's Allocation %/Working Hours — it's the first story that actually needs `domain/calendar.ts`'s day-counting/overlap logic.
- Story 2.6 (Allocated Hours breakdown) depends on 2.5's `AllocationBreakdown` type/computation existing first.
