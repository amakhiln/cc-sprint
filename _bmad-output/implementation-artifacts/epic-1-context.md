# Epic 1 Context: Team Roster, Allocation & Sprint Setup

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic lays the foundation everything else in the product depends on: a PM builds out a team roster, defines the shared set of Allocation Categories used to split each Team Member's time, assigns per-person percentages across those categories, and creates the Sprint container that all planning happens inside. Nothing in Leave/Capacity (Epic 2), YouTrack issue assignment (Epic 3), or Sprint Lifecycle (Epic 4) can function without a roster, allocation percentages, and an active Sprint existing first — this epic also includes the initial project scaffold that every later story builds on.

## Stories

- Story 1.1: Project Scaffold from Starter Template
- Story 1.2: Add Team Member
- Story 1.3: Remove Team Member
- Story 1.4: Configure Shared Allocation Category List
- Story 1.5: Assign Allocation % per Team Member
- Story 1.6: Edit Allocation % and Working Hours
- Story 1.7: Create a Sprint

## Requirements & Constraints

- A Team Member has a name and a default daily Working Hours value; name is required (validation error if missing).
- Removing a Team Member is a soft delete only — they disappear from selection for new assignment/leave/allocation, but their historical contribution to any closed Sprint remains visible unchanged. No physical deletion ever occurs.
- Allocation Categories are one shared list reused by the whole team (not per-person lists): addable, renameable (renames propagate everywhere the category is referenced, including existing Team Member allocations), and removable only after any Team Member currently using that category is reassigned elsewhere.
- A Team Member's Allocation % across their assigned categories should sum to 100%, but this is enforced as a warning, not a block — saving with a mismatched sum is always allowed.
- Editing a Team Member's Allocation % or Working Hours applies prospectively only: it affects the current and future Sprints but must never recalculate or alter a Sprint that has already been closed.
- Exactly one Sprint may be active at a time; creating a new Sprint while one is active is rejected. A Sprint has a start date and a length (default two weeks, editable).
- Dates operate at day granularity everywhere (no time-of-day component).
- Glossary terms to use verbatim in code and UI: Team Member, Allocation Category, Allocation %, Working Hours, Sprint.

## Technical Decisions

- **Architecture paradigm**: Lightweight Hexagonal (Ports & Adapters). A framework-free `domain/` module owns all business rules — no Next.js/Prisma/MCP imports there. `app/` (routes, Server Actions) and `infrastructure/` (db) are adapters calling into `domain/`, never the reverse. This epic's logic lives in `domain/allocation.ts` (Team Member CRUD, Allocation Category CRUD, Allocation %, Working Hours) and `domain/sprint.ts` (Sprint creation, single-active-Sprint rule — new file, doesn't exist yet).
- All writes go through `domain/`'s validate-then-persist functions — never a raw Prisma call from a route/component. Server Actions return a discriminated result (`{ok:true,data}` | `{ok:false,error}`) rather than throwing, giving the UI one uniform error-handling shape.
- Single-active-Sprint enforcement lives in the domain layer (DB constraint or guard in the create-Sprint function), not just the UI — `Sprint.status` is a Prisma enum (`active`/`closed`), never a free string.
- Data model for this epic (Prisma model names mirror PRD Glossary terms exactly, no synonyms): `TeamMember`, `AllocationCategory`, `TeamMemberAllocation` (all exist as of Story 1.6) — plus `Sprint` (startDate, endDate, status enum, nullable snapshot fields populated only on close — snapshotting is out of scope for this epic but the fields exist on the model from the start), still to be added. IDs use Prisma's default `cuid()`; dates are Postgres `date` type; date ranges are inclusive on both ends.
- Repo pattern convention established across Stories 1.2-1.6: one port/repo per aggregate; atomic `update()`+catch-`P2025` (not `updateMany`+count) for single-row not-found checks; `updateMany`+count+refetch specifically when an additional non-unique filter condition (like `archivedAt: null`) must be enforced atomically alongside the id match, since Prisma's `update()` only accepts a unique `where`.

## UX & Interaction Patterns

- **Visual identity reworked 2026-08-17** (see `_bmad-output/planning-artifacts/ux-designs/ux-pm-2026-08-12/DESIGN.md`, amended): full glassmorphism now applies to every panel/card/dialog, not just floating overlays — use the existing `.glass`/`.glass-strong`/`.glass-row` utility classes already wired into `app/globals.css` (added when this rework was applied to the Roster page) rather than inventing new ad hoc styles. Fonts are General Sans (display/headings, `font-heading`) + Satoshi (body, default `font-sans`) via the Fontshare `<link>` in `app/layout.tsx`. Colors are the Aurora Light palette (peach/lilac/mint/gold accents, single `signal-warning` for all warnings) — see DESIGN.md's Colors section for exact tokens; the shadcn semantic CSS vars (`--primary`, `--border`, `--card`, etc.) are already remapped to these, so components using standard shadcn/Tailwind classes (`bg-primary`, `border-border`, etc.) pick up the new palette automatically.
- **Pointer affordance** (EXPERIENCE.md, Interaction Primitives): every interactive element must show `cursor: pointer` — the shared `Button` component already has this; any raw `<button>`/clickable element must add it explicitly (see `add-team-member-form.tsx`'s submit button for the established pattern).
- **No active Sprint state**: Sprint Plan shows an invitation to create a Sprint instead of an empty table when none is active — this pattern doesn't have a built screen yet (Sprint Plan Overview is Epic 4's Story 4.1), so Story 1.7 only needs the create-Sprint action/form itself, not a full "no active sprint" empty state on a screen that doesn't exist yet.
- **Confirm-before-destructive**: named in EXPERIENCE.md for Remove Team Member and Close Sprint specifically — creating a Sprint is additive, not destructive, so no confirmation dialog is implied for Story 1.7.
- Every hours/percentage/date figure should stay visually prominent (Display face, per DESIGN.md) — the dedicated monospace "Data face" from the original thesis was dropped in the 2026-08-17 rework in favor of the Display face for all figures.

## Cross-Story Dependencies

- Story 1.1 (scaffold) is a hard prerequisite for every other story in this and later epics.
- Story 1.4 (shared Allocation Category list) was a prerequisite for Story 1.5 (per-person Allocation %); both are done.
- Stories 1.2/1.3 (add/remove Team Member) and 1.5/1.6 (allocation and working hours) together produce the roster state that Epic 2's Capacity calculation reads directly.
- Story 1.7 (create a Sprint) establishes the single active Sprint that Epic 2 (Leave/Capacity), Epic 3 (YouTrack issue assignment), and Epic 4 (Sprint lifecycle/sharing) all plan against — this is the last story in Epic 1 and unblocks every remaining epic.
