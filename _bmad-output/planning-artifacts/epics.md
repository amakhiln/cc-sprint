---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-pm-2026-08-12/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md
  - _bmad-output/specs/spec-sprint-velocity-planner/SPEC.md
  - _bmad-output/planning-artifacts/ux-designs/ux-pm-2026-08-12/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-pm-2026-08-12/EXPERIENCE.md
---

# Sprint & Velocity Planner - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Sprint & Velocity Planner, decomposing the requirements from the PRD, Architecture Spine (via the adopted SPEC.md contract), and UX Design contract into implementable stories. `[NOTE]` The UX design pass ran after this document's initial epics/stories were created; UX-DR references below were added retroactively during the sprint-planning readiness fix, along with two UX patterns (Allocation Category Manager, Velocity History Trend) that the readiness check found were missing from EXPERIENCE.md entirely, not just unlinked.

## Requirements Inventory

### Functional Requirements

FR1: PM can add a Team Member with a name and default daily Working Hours.
FR2: PM can remove a Team Member from the active roster; their historical contribution in closed Sprints remains visible (soft delete, not retroactive deletion).
FR3: PM maintains one shared list of Allocation Categories (add, rename, remove) reused across the whole team.
FR4: PM assigns each Team Member a % of their time across one or more Allocation Categories, validated to sum to 100% (warned, not blocked, if it doesn't).
FR5: PM can edit a Team Member's Allocation % breakdown and/or default Working Hours at any time; changes apply prospectively only.
FR6: PM can enter a date range of Planned Leave for a Team Member.
FR7: PM can enter a date range of Emergency Leave for a Team Member at any point, including mid-Sprint; recalculates immediately.
FR8: PM can mark a date (or date range) as a company-wide Holiday, applying to all Team Members at once.
FR9: System reduces a Team Member's Capacity by distinct working days lost to Leave and/or Holiday — no double-counting overlaps, no counting weekend/non-working days.
FR10: PM can view all Leave (Planned/Emergency, type distinguished) and Holiday entries for a Team Member within a given Sprint.
FR11: System computes each Team Member's Capacity for a Sprint (working days × Working Hours × Dev Allocation % − Leave/Holiday hours).
FR12: System sums per-person Capacity into a total team Capacity for the Sprint.
FR13: PM can view an Allocated Hours breakdown by Team Member and Allocation Category (Leave/Holiday reduction applies uniformly across all categories, not just Dev).
FR14: System tracks Planned Velocity (at Sprint start) and pulls Actual Velocity automatically from YouTrack logged time-tracking hours at Sprint close; PM reviews/adjusts before confirming.
FR15: System retains Planned and Actual Velocity for every closed Sprint and displays a sprint-over-sprint trend.
FR16: PM can configure a connection to one YouTrack Project via its MCP server (instance URL, project, auth token); an invalid connection surfaces a clear inline error.
FR17: PM can browse the configured YouTrack Project's open Backlog Issues (summary, assignee, priority, estimate field); read-only — no writes back to YouTrack; no native sprint/board object exists on the YouTrack MCP surface (confirmed by PM directly); no automatic carry-over of unfinished issues between Sprints.
FR18: PM can pull selected Backlog Issues into the current Sprint plan, with estimate hours (from a configurable custom field, manual fallback if absent) counted against the assignee's Capacity.
FR19: System shows an advisory (non-blocking) over-allocation warning when planned issue hours exceed computed Capacity, for a Team Member or the team.
FR20: PM can create a new Sprint (start date + length, default 2 weeks, editable); exactly one Sprint may be active at a time.
FR21: PM can assign each selected Backlog Issue to a specific Team Member within the Sprint.
FR22: PM can view, on one screen, roster, per-person Capacity/Allocation breakdown, Leave/Holidays, assigned Backlog Issues, and total planned vs. available Capacity.
FR23: PM can close an active Sprint — confirming/adjusting Actual Velocity, locking it into Velocity History, marking the Sprint read-only; unfinished issues stay in YouTrack, unassigned, until manually re-pulled.
FR24: Any team member can view the current Sprint's plan (roster, capacity, leave, holidays, assigned issues) via a shared link with an unguessable token — no login, no edit controls. `[NOTE]` v0 hosting (app on PM's laptop) means this link only works while the laptop is on/reachable — functionally limited until always-on hosting is revisited.
FR25: PM can ask the Query Assistant a natural-language question and receive an answer grounded in real data (a YouTrack MCP tool call or this app's own domain computation) — never a fabricated figure; an ungroundable question is answered by saying so, not by guessing.
FR26: The Query Assistant is only ever given read/query-capable YouTrack MCP tools (issue search/read, time-tracking read, project/user/article lookup); write-capable tools (create/update issue, comment, log time) are never registered with it, so no prompt can reach them.
FR27: PM can ask a question spanning both YouTrack MCP data and this app's own domain data (Capacity, Allocation, Leave, Velocity) in one query, with each figure in the answer attributed to its actual source.
FR28: The Query Assistant is available only within the PM's own editing session — never reachable from the read-only Team View share link.

### NonFunctional Requirements

NFR1: No authentication/login system exists anywhere in v1. The PM's editing surface is protected only by network placement (trusted network); the read-only Team View is protected by an unguessable link token, not login.
NFR2: A closed Sprint's recorded Capacity, Allocation breakdown, and confirmed Actual Velocity are immutable — later roster/allocation/leave changes never retroactively alter closed-Sprint history.
NFR3: Viewing an already-planned Sprint must never depend on the YouTrack MCP connection being reachable — Backlog Issue data (title, estimate, assignee) is copied into local storage at pull time, not live-fetched on every view.
NFR4: An invalid, expired, or unreachable YouTrack connection must surface a clear inline error at configuration time, never fail silently.
NFR5: Dates operate at day granularity throughout (leave, holidays, sprint boundaries) with inclusive start/end ranges — no time-of-day component.
NFR6: Every numeric or factual claim in a Query Assistant answer is substituted in by app code from a real tool-call or domain-computation return value — enforced by construction (the LLM never types a figure itself), not by prompt instruction alone.
NFR7: An MCP connection failure or timeout during a Query Assistant query surfaces as a clear inline message in the chat response, never a silent wrong answer or an indefinite hang — mirrors NFR4's connection-error handling.
NFR8: For a closed Sprint, the Query Assistant reads the persisted Capacity/Allocation/Velocity snapshot rather than recomputing live — consistent with NFR2's closed-Sprint immutability guarantee.

### Additional Requirements

- **Starter Template**: `create-next-app` — Next.js 16.3.x, App Router, TypeScript, Tailwind CSS, Turbopack (default bundler). Epic 1 Story 1 should scaffold from this starter.
- **Architecture paradigm**: Lightweight Hexagonal (Ports & Adapters). A pure, framework-free `domain/` module owns all Capacity/Allocation/Leave/Velocity/Sprint math (no Next.js, Prisma, or MCP imports there). `app/` (routes, UI, Server Actions) and `infrastructure/` (db, youtrack) are adapters that call into `domain/`, never the reverse.
- **Database**: Supabase (Postgres, free tier — auto-pauses after 7 days of inactivity), accessed via Prisma 7.x ORM.
- **YouTrack MCP client**: `@modelcontextprotocol/client` package (the split client package, not the legacy monolithic `@modelcontextprotocol/sdk`). One server-only adapter module (`infrastructure/youtrack/`) — the only module permitted to import it. Instance URL/token stored server-side only in a `YouTrackConfig` singleton row, never sent to the client bundle.
- **Deployment (v0)**: Next.js app hosted on the PM's own laptop; only the Postgres database is cloud-hosted (Supabase). Known limitation: FR24/Team View isn't reachable independent of the laptop being on — revisit when always-on hosting is addressed.
- **Data model** (see Architecture Spine ERD for full detail): `TeamMember` (soft-delete via `archivedAt`), `AllocationCategory`, `TeamMemberAllocation` (join + %), `Leave`, `Holiday`, `Sprint` (`status` enum `active`/`closed`; nullable snapshot fields for Capacity/AllocationBreakdown/ActualVelocity, populated only on close), `BacklogIssue` (one row per `(sprintId, youtrackIssueId)` pull — never a shared mutable row across Sprints; `loggedHoursPulledAt` distinct from `loggedHours` to disambiguate "0 logged" from "not yet pulled"), `YouTrackConfig` (singleton), `ShareToken` (singleton — one standing app-level token, not per-Sprint).
- **Shared domain logic requirement**: date-range/working-day/overlap calculations live in one shared `domain/calendar.ts`, used by both leave and capacity calculations — never reimplemented per call site. `domain/capacity.ts` exports one shared `AllocationBreakdown` type used by both the Capacity figure (FR11/12) and the FR13 breakdown view.
- **Read-only route isolation**: the `/share/[token]` route may only import read-side domain/query functions — no module reachable from it may import a write-capable Server Action.
- **Single active Sprint enforcement**: enforced at the domain layer (e.g. a DB constraint or guard in the create-Sprint function), not just the UI.
- **Error handling convention**: Server Actions return a discriminated result (`{ok:true,data}` \| `{ok:false,error}`) rather than throwing.
- **Naming convention**: Prisma models mirror the PRD Glossary terms exactly — no synonyms introduced in code.
- **Query Assistant adapters** (Architecture AD-7/AD-8): a new server-only adapter `infrastructure/youtrack-mcp/` is the only module permitted to import `@modelcontextprotocol/client`; it exports one canonical read-only tool allowlist constant shared between MCP tool registration and the LLM's advertised tool list, so the two can never drift apart. A new singleton `YouTrackMcpConfig` (`mcpServerUrl`, `authToken`, `projectId`) is separate from `YouTrackConfig` (REST) — needs its own connect/configure story, parallel to FR-16's pattern.
- **Query Assistant orchestration** (AD-8): a new adapter `infrastructure/query-assistant/` holds only the LLM tool-calling loop (Anthropic Claude, Messages API/`tool_use`) and is composed by injection — it never imports `infrastructure/youtrack-mcp/` or any other `infrastructure/` module directly. The actual wiring (loading data via `infrastructure/db/` repositories, calling `domain/` compute functions, calling `infrastructure/youtrack-mcp/`'s tools, streaming a tagged-union response) happens in a new thin route handler `app/api/assistant/route.ts`, wired only into the PM's own editing UI — never `app/share/[token]/`.
- **Still open**: PRD Open Question 4 / Architecture Deferred item — verify the live YouTrack MCP server's actual read/write tool list against the allowlist assumption before or early in implementation of FR-25/FR-26.
- **Data governance (adopted)**: roster/allocation/leave/YouTrack data is sent to the LLM provider (Anthropic) as-is, unredacted — PM-confirmed decision (Architecture AD-8); no pseudonymization layer is built.

### UX Design Requirements

UX-DR1: Implement the Capacity Ledger component (segmented purple/amber bar, Data-face headline figure, live recalculation) at the top of Sprint Plan Overview and as a smaller per-row instance in the Roster table.
UX-DR2: Implement the Status Chip component with exactly two variants — neutral (`surface-raised`) for informational tags, signal (`signal-leave`-tinted) for Holiday and the over-allocation warning — never a third color.
UX-DR3: Implement the Backlog Drawer as a right-side slide-over with the frosted-glass Overlay Surface treatment (translucent background, 20px backdrop-blur, `prefers-reduced-transparency` fallback to opaque).
UX-DR4: Implement the Sprint Close Flow as a modal (not a full-page navigation) showing each assigned issue's auto-pulled Actual Velocity, editable, with a running total.
UX-DR5: Implement the Allocation % Editor with a live running-sum indicator that warns (not blocks) when the total drifts off 100%.
UX-DR6: Implement the Team Member Detail Panel as the single home for per-person editing — Allocation %, Working Hours, and the Log Leave action — opened consistently from any screen that shows that Team Member.
UX-DR7: Implement the Leave Entry popover/modal with a Planned/Emergency toggle and the same frosted-glass Overlay Surface treatment as the Backlog Drawer.
UX-DR8: Implement the Holiday Manager in Settings — a list of existing Holidays plus an add-date-range control, company-wide, with no per-person selection.
UX-DR9: Implement the Allocation Category Manager on Roster — add/rename/remove, propagating renames everywhere the category is used, blocking removal while a Team Member still uses it.
UX-DR10: Implement the Velocity History Trend as a single table (Sprint, Planned Velocity, Actual Velocity, delta) in the Data face with tabular figures — no chart in v1.
UX-DR11: Implement the Closed Sprint state with edit affordances fully absent (not merely disabled) across every editing surface that touches that Sprint's data.
UX-DR12: Apply the DESIGN.md token system (colors, the monospace Data-face signature for every hours/%/velocity figure, spacing, radii) via shadcn/ui theme overrides, not one-off component styling.
UX-DR13: Meet the Accessibility Floor — WCAG AA contrast, visible keyboard focus rings, status conveyed by label as well as color, and `prefers-reduced-motion`/`prefers-reduced-transparency` fallbacks for the Capacity Ledger animation and overlay glass respectively.

### UX-DR Coverage Map

UX-DR1: Epic 2 (Story 2.5), Epic 4 (Story 4.1) - Capacity Ledger
UX-DR2: Epic 2 (Story 2.4), Epic 3 (Story 3.5) - Status Chip
UX-DR3: Epic 3 (Stories 3.2, 3.3) - Backlog Drawer
UX-DR4: Epic 4 (Story 4.2) - Sprint Close Flow
UX-DR5: Epic 1 (Story 1.5) - Allocation % Editor
UX-DR6: Epic 1 (Stories 1.5, 1.6), Epic 2 (Stories 2.1, 2.2) - Team Member Detail Panel
UX-DR7: Epic 2 (Stories 2.1, 2.2) - Leave Entry
UX-DR8: Epic 2 (Story 2.3) - Holiday Manager
UX-DR9: Epic 1 (Story 1.4) - Allocation Category Manager
UX-DR10: Epic 4 (Story 4.3) - Velocity History Trend
UX-DR11: Epic 4 (Story 4.2) - Closed Sprint state
UX-DR12: All epics - applies globally, no single owning story
UX-DR13: All epics - applies globally, no single owning story

### FR Coverage Map

FR1: Epic 1 - Add Team Member
FR2: Epic 1 - Remove Team Member (soft delete)
FR3: Epic 1 - Configure shared Allocation Category list
FR4: Epic 1 - Assign Allocation % per Team Member
FR5: Epic 1 - Edit Allocation % and Working Hours
FR20: Epic 1 - Create a Sprint (single active Sprint rule)
FR6: Epic 2 - Record Planned Leave
FR7: Epic 2 - Record Emergency Leave
FR8: Epic 2 - Record Holiday / Office Closure
FR9: Epic 2 - Leave/Holiday reduce Capacity proportionally
FR10: Epic 2 - View Leave and Holidays by Team Member and Sprint
FR11: Epic 2 - Compute per-person Capacity
FR12: Epic 2 - Compute team Capacity
FR13: Epic 2 - View Allocated Hours breakdown
FR16: Epic 3 - Connect to YouTrack
FR17: Epic 3 - Browse YouTrack Backlog Issues
FR18: Epic 3 - Assign Backlog Issues into a Sprint
FR19: Epic 3 - Over-allocation warning
FR21: Epic 3 - Assign issues to Team Members within a Sprint
FR14: Epic 4 - Track Planned vs. Actual Velocity
FR15: Epic 4 - Velocity History and trend
FR22: Epic 4 - Sprint Plan overview
FR23: Epic 4 - Close a Sprint
FR24: Epic 4 - Shared read-only Sprint Plan view
FR25: Epic 5 - Ask a natural-language question, get a grounded answer
FR26: Epic 5 - Read-only enforcement at the tool layer
FR27: Epic 5 - Cross-source queries spanning YouTrack + app domain data
FR28: Epic 5 - Chat scoped to the PM's own session

## Epic List

### Epic 1: Team Roster, Allocation & Sprint Setup
PM can build out a team roster, configure allocation categories and per-person percentages, and create/manage a Sprint container (enforcing the one-active-Sprint rule).
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR20

### Epic 2: Leave, Holidays & Capacity Calculation
PM can record Planned/Emergency Leave and company Holidays, and see a real computed Capacity number — per person, team-wide, and broken down by Allocation Category — for the current Sprint.
**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13

### Epic 3: YouTrack Integration & Issue Assignment
PM can connect to YouTrack, browse the configured project's backlog, pull issues into the Sprint, assign them to Team Members, and see an advisory over-allocation warning against computed Capacity.
**FRs covered:** FR16, FR17, FR18, FR19, FR21

### Epic 4: Sprint Lifecycle, Velocity Tracking & Team Sharing
PM gets the full one-screen Sprint Plan overview, can close a Sprint (confirming pulled Actual Velocity), sees Velocity History as a trend, and the team gets the read-only shared view of the current plan.
**FRs covered:** FR14, FR15, FR22, FR23, FR24

### Epic 5: Conversational Query & Reporting Assistant
PM can connect a YouTrack MCP server (separate from the existing REST connection) and ask the Query Assistant natural-language questions — spanning YouTrack data and this app's own domain data — answered with grounded, source-attributed figures, scoped to the PM's own session only.
**FRs covered:** FR25, FR26, FR27, FR28

## Epic 1: Team Roster, Allocation & Sprint Setup

PM can build out a team roster, configure allocation categories and per-person percentages, and create/manage a Sprint container (enforcing the one-active-Sprint rule).

### Story 1.1: Project Scaffold from Starter Template

As a developer,
I want the project scaffolded from the Next.js starter with the hexagonal directory structure and database connection in place,
So that every subsequent story builds on a working, correctly-structured foundation.

**Acceptance Criteria:**

**Given** no project exists yet
**When** the project is scaffolded via `create-next-app` with App Router, TypeScript, and Tailwind CSS
**Then** the app runs locally and serves the default starter page

**Given** the scaffolded project
**When** the hexagonal directory structure is added
**Then** `app/`, `domain/`, `infrastructure/`, and `prisma/` folders exist per the Architecture Spine's Structural Seed

**Given** the directory structure exists
**When** Prisma is initialized and pointed at a Supabase Postgres database
**Then** a Prisma schema file exists and a test connection to the database succeeds

### Story 1.2: Add Team Member

As a PM,
I want to add a Team Member with a name and default daily Working Hours,
So that they're available for allocation, leave, and sprint assignment.

**UX:** EXPERIENCE.md Voice and Tone → the empty-roster copy example; State Patterns → "Empty roster" (invitation to add the first Team Member, not a blank table).

**Acceptance Criteria:**

**Given** I am on the Team Roster screen
**When** I add a new Team Member with a name and default Working Hours
**Then** the Team Member appears on the roster immediately
**And** they are available to be selected for Allocation, Leave, and Sprint assignment

**Given** I try to add a Team Member without a name
**When** I submit the form
**Then** the system rejects the submission with a validation error

### Story 1.3: Remove Team Member

As a PM,
I want to remove a Team Member from the active roster,
So that they no longer appear for new work while their history stays intact.

**UX:** EXPERIENCE.md Interaction Primitives → "Confirm-before-destructive" (a lightweight confirmation dialog, not a full-page interstitial).

**Acceptance Criteria:**

**Given** a Team Member exists on the active roster
**When** I remove them
**Then** they no longer appear as an option for new Sprint assignment or Leave entry
**And** their record is soft-deleted (`archivedAt` set), never physically deleted

**Given** a Team Member was part of a closed Sprint before being removed
**When** I view that closed Sprint's history
**Then** their Capacity and Velocity contribution is still visible, unchanged

### Story 1.4: Configure Shared Allocation Category List

As a PM,
I want to maintain one shared list of Allocation Categories (add, rename, remove),
So that every Team Member's time is split using the same consistent set of categories.

**UX:** UX-DR9, EXPERIENCE.md Component Patterns → Allocation Category Manager.

**Acceptance Criteria:**

**Given** I am configuring Allocation Categories
**When** I add a new category (e.g. "DevOps")
**Then** it becomes available to assign to any Team Member

**Given** a category is renamed
**When** the rename is saved
**Then** its new label appears everywhere it's used, including existing Team Member allocations

**Given** a category is currently assigned to at least one Team Member
**When** I try to remove it
**Then** I must reassign that percentage first before the category can be removed

### Story 1.5: Assign Allocation % per Team Member

As a PM,
I want to assign each Team Member a percentage of their time across one or more Allocation Categories,
So that I know how much of their time is Dev vs. Management vs. other categories.

**UX:** UX-DR5, UX-DR6, EXPERIENCE.md Component Patterns → Allocation % Editor, Team Member Detail Panel; [mockup](ux-designs/ux-pm-2026-08-12/mockups/key-team-member-detail.html).

**Acceptance Criteria:**

**Given** a Team Member and the shared Allocation Category list
**When** I assign percentages across categories that sum to 100%
**Then** the breakdown saves with no warning shown

**Given** a Team Member's assigned percentages do not sum to 100%
**When** I save
**Then** the save is still allowed, but a clear warning appears both at save time and anywhere that Team Member's Capacity is displayed

### Story 1.6: Edit Allocation % and Working Hours

As a PM,
I want to change a Team Member's Allocation % breakdown and/or default Working Hours at any time,
So that I can keep their profile current as roles shift.

**UX:** UX-DR6, EXPERIENCE.md Component Patterns → Team Member Detail Panel; [mockup](ux-designs/ux-pm-2026-08-12/mockups/key-team-member-detail.html).

**Acceptance Criteria:**

**Given** a Team Member has an existing Allocation % breakdown
**When** I edit and save new percentages or Working Hours
**Then** the change applies to the current and future Sprints only

**Given** a Sprint has already been closed
**When** I later edit that Team Member's Allocation % or Working Hours
**Then** the closed Sprint's recorded Capacity is not recalculated or altered

### Story 1.7: Create a Sprint

As a PM,
I want to create a new Sprint with a start date and length (default two weeks, editable),
So that I have a defined period to plan work against.

**UX:** EXPERIENCE.md State Patterns → "No active Sprint" (Sprint Plan shows an invitation to create one, per Voice and Tone conventions).

**Acceptance Criteria:**

**Given** no Sprint is currently active
**When** I create a new Sprint with a start date and length
**Then** the Sprint is created with status "active" and becomes the current Sprint

**Given** a Sprint is already active
**When** I attempt to create another Sprint
**Then** the system rejects it — I cannot have two Sprints open at the same time

## Epic 2: Leave, Holidays & Capacity Calculation

PM can record Planned/Emergency Leave and company Holidays, and see a real computed Capacity number — per person, team-wide, and broken down by Allocation Category — for the current Sprint.

### Story 2.1: Record Planned Leave

As a PM,
I want to enter a date range of Planned Leave for a Team Member,
So that a Sprint's Capacity accounts for the time they'll be away.

**UX:** UX-DR6, UX-DR7, EXPERIENCE.md Component Patterns → Team Member Detail Panel, Leave Entry; [mockup](ux-designs/ux-pm-2026-08-12/mockups/key-team-member-detail.html).

**Acceptance Criteria:**

**Given** a Team Member and a current or future Sprint
**When** I enter a Planned Leave date range for them
**Then** the affected Sprint's Capacity for that Team Member recalculates to reflect the leave days

### Story 2.2: Record Emergency Leave

As a PM,
I want to enter Emergency Leave for a Team Member at any point, including mid-Sprint,
So that a sudden absence is reflected immediately.

**UX:** UX-DR6, UX-DR7, EXPERIENCE.md Component Patterns → Team Member Detail Panel, Leave Entry (Emergency toggle); [mockup](ux-designs/ux-pm-2026-08-12/mockups/key-team-member-detail.html). Key Flow UJ-2 depicts exactly this story.

**Acceptance Criteria:**

**Given** an active Sprint already underway
**When** I enter Emergency Leave for a Team Member for the remaining days
**Then** Capacity recalculates immediately, with no further action needed

### Story 2.3: Record Holiday / Office Closure

As a PM,
I want to mark a date or date range as a company-wide Holiday,
So that everyone's Capacity reflects it without entering leave per person.

**UX:** UX-DR8, EXPERIENCE.md Component Patterns → Holiday Manager (lives in Settings, not per-Team-Member).

**Acceptance Criteria:**

**Given** a Sprint's date range includes a Holiday
**When** I mark that date (or range) as a Holiday
**Then** every Team Member's Capacity for that Sprint reduces by their Working Hours × Dev Allocation % for that day
**And** I did not need to create a separate Leave entry for each Team Member

### Story 2.4: View Leave and Holidays by Team Member and Sprint

As a PM,
I want to see all Leave and Holiday entries for a Team Member within a given Sprint,
So that I can review what's affecting their availability at a glance.

**UX:** UX-DR2, EXPERIENCE.md Component Patterns → Status Chip (type-distinguishing chips), Team Member Detail Panel's Leave list.

**Acceptance Criteria:**

**Given** a Team Member has Planned Leave, Emergency Leave, and/or Holidays recorded within a Sprint
**When** I view their entries for that Sprint
**Then** each entry displays its type (Planned Leave, Emergency Leave, or Holiday) and date range, distinguishable at a glance

### Story 2.5: Compute Sprint Capacity (Per-Person and Team Total)

As a PM,
I want the system to compute each Team Member's Capacity and the team's total Capacity for a Sprint, accounting for Leave and Holidays,
So that I know the real available hours instead of guessing.

**UX:** UX-DR1, EXPERIENCE.md Component Patterns → Capacity Ledger; [mockup](ux-designs/ux-pm-2026-08-12/mockups/key-sprint-plan-overview.html).

**Acceptance Criteria:**

**Given** a Team Member's Working Hours, Dev Allocation %, and the Sprint's working days
**When** Capacity is computed with no Leave or Holidays recorded
**Then** Capacity equals Sprint working days × Working Hours × Dev Allocation %

**Given** a Team Member has 2 days of Leave plus 1 non-overlapping company Holiday in a 10-working-day Sprint, at 8 Working Hours/day and 60% Dev allocation
**When** Capacity is computed
**Then** 14.4 hours are deducted (3 × 8 × 0.6), matching the PRD's worked example

**Given** a Team Member's Leave range happens to include a Holiday date
**When** Capacity is computed
**Then** that calendar day counts once, not twice (3 distinct days lost, not 4)

**Given** a Team Member's Leave range spans a weekend
**When** Capacity is computed
**Then** the weekend days are excluded from the day-count entirely

**Given** each Team Member's Capacity has been computed
**When** I view the Sprint's total Capacity
**Then** it equals the sum of every Team Member's individual Capacity

### Story 2.6: View Allocated Hours Breakdown

As a PM,
I want to view each Team Member's hours broken down by Allocation Category, plus a team-wide total per category,
So that I can see how much time goes to Dev vs. Management vs. other categories.

**UX:** UX-DR1, UX-DR12, EXPERIENCE.md Component Patterns → Capacity Ledger (select/expand reveals this breakdown); DESIGN.md Components → Data Figure for every hours figure shown.

**Acceptance Criteria:**

**Given** a Team Member with multiple Allocation Categories
**When** I view their Allocated Hours breakdown for the current Sprint
**Then** I see hours per category, with Leave/Holiday reduction applied uniformly across all categories for the affected days — not only Dev

**Given** the per-category breakdown for every Team Member
**When** I view the team-wide breakdown
**Then** I see a team-wide total per category

## Epic 3: YouTrack Integration & Issue Assignment

PM can connect to YouTrack, browse the configured project's backlog, pull issues into the Sprint, assign them to Team Members, and see an advisory over-allocation warning against computed Capacity.

### Story 3.1: Connect to YouTrack

As a PM,
I want to configure a connection to one YouTrack Project via its MCP server,
So that I can pull real backlog work into my sprint planning.

**UX:** EXPERIENCE.md State Patterns → "YouTrack not configured" and "YouTrack connection error" (surfaces inline on this form, never a dismissible toast).

**Acceptance Criteria:**

**Given** I have a YouTrack instance URL, project, and auth token
**When** I save the connection
**Then** it's stored and used for all subsequent YouTrack browsing and pulls

**Given** I enter an invalid URL, an invalid/expired token, or an unreachable server
**When** I try to save the connection
**Then** a clear inline error is shown and the connection is not saved

### Story 3.2: Browse YouTrack Backlog Issues

As a PM,
I want to view the configured YouTrack Project's open Backlog Issues,
So that I can decide what to pull into the sprint.

**UX:** UX-DR3, EXPERIENCE.md Component Patterns → Backlog Drawer (right-side slide-over, frosted-glass overlay); [mockup](ux-designs/ux-pm-2026-08-12/mockups/key-backlog-drawer.html).

**Acceptance Criteria:**

**Given** a saved YouTrack connection
**When** I open the backlog browser
**Then** I see the project's open issues with summary, assignee, priority, and estimate field where available

**Given** the backlog browser
**When** I view it
**Then** there is no way to create, edit, comment on, or otherwise write back to a YouTrack issue from this screen — browsing is strictly read-only

### Story 3.3: Pull Backlog Issues into a Sprint

As a PM,
I want to pull selected Backlog Issues into the current Sprint plan,
So that the sprint reflects real tracked work instead of a manually re-typed list.

**UX:** UX-DR3, EXPERIENCE.md Component Patterns → Backlog Drawer ("Pull selected" stays open for further selection); [mockup](ux-designs/ux-pm-2026-08-12/mockups/key-backlog-drawer.html).

**Acceptance Criteria:**

**Given** a Backlog Issue with a value in the configured estimate custom field
**When** I pull it into the current Sprint
**Then** its estimate hours are counted against its assignee's Capacity

**Given** a Backlog Issue with no value in the configured estimate field
**When** I pull it into the current Sprint
**Then** I'm prompted to enter an hours estimate manually

**Given** the same YouTrack issue is pulled into two different Sprints over its lifetime
**When** each pull happens
**Then** each Sprint gets its own independent local record of that issue — a later pull never overwrites or reuses an earlier Sprint's copy

### Story 3.4: Assign Issues to Team Members within a Sprint

As a PM,
I want to assign each pulled Backlog Issue to a specific Team Member within the Sprint,
So that Capacity and over-allocation reflect who's actually doing the work.

**UX:** EXPERIENCE.md Component Patterns → Backlog Drawer and Sprint Plan's issue rows (assignment happens inline in both places).

**Acceptance Criteria:**

**Given** a Backlog Issue pulled into the current Sprint
**When** I assign it to a Team Member
**Then** its estimate hours count against that Team Member's Capacity

**Given** an issue already assigned to one Team Member
**When** I reassign it to a different Team Member
**Then** the estimate hours move to count against the new assignee's Capacity instead

### Story 3.5: Over-Allocation Warning

As a PM,
I want to see a warning when a Team Member's or the team's planned issue hours exceed their computed Capacity,
So that over-committing is a visible choice, not a surprise later.

**UX:** UX-DR2, EXPERIENCE.md State Patterns → "Over-allocation" (advisory chip, never disables the action it's attached to).

**Acceptance Criteria:**

**Given** a Team Member's assigned issue hours exceed their computed Capacity
**When** I view the Sprint plan
**Then** a warning is shown for that Team Member

**Given** the warning is showing
**When** I continue assigning issues or finalize the Sprint
**Then** nothing is blocked — the warning is advisory only

## Epic 4: Sprint Lifecycle, Velocity Tracking & Team Sharing

PM gets the full one-screen Sprint Plan overview, can close a Sprint (confirming pulled Actual Velocity), sees Velocity History as a trend, and the team gets the read-only shared view of the current plan.

### Story 4.1: Sprint Plan Overview

As a PM,
I want to see roster, Capacity/Allocation breakdown, Leave/Holidays, assigned issues, and planned-vs-available Capacity together on one screen,
So that I can assess the whole sprint plan at a glance.

**UX:** UX-DR1, UX-DR12, EXPERIENCE.md Information Architecture → Sprint Plan (the canonical entry surface); [mockup](ux-designs/ux-pm-2026-08-12/mockups/key-sprint-plan-overview.html). Key Flow UJ-1 walks through this screen end to end.

**Acceptance Criteria:**

**Given** an active Sprint with Team Members, allocations, leave/holidays, and assigned issues
**When** I open the Sprint Plan screen
**Then** I see roster, per-person Capacity and Allocation breakdown, Leave and Holidays, assigned Backlog Issues, and total planned vs. available Capacity all in one view

### Story 4.2: Close a Sprint and Confirm Actual Velocity

As a PM,
I want to review and confirm the auto-pulled Actual Velocity when I close a Sprint,
So that Velocity History reflects numbers I've verified, not just raw YouTrack data.

**UX:** UX-DR4, UX-DR11, EXPERIENCE.md Component Patterns → Sprint Close Flow (modal, not full-page nav); State Patterns → "Actual Velocity 0 vs. not-yet-checked" and "Closed Sprint" (no edit affordances at all afterward, not just disabled inputs).

**Acceptance Criteria:**

**Given** an active Sprint ready to close
**When** I initiate closing it
**Then** the system pulls Actual Velocity automatically from each assigned Backlog Issue's logged time-tracking hours in YouTrack and shows the pulled figures, editable, per issue and in total

**Given** an issue with no logged time
**When** its Actual Velocity is pulled
**Then** it shows as 0 hours, clearly distinguished from "not yet checked," so I know to fill it in manually if needed

**Given** I've reviewed and optionally adjusted the pulled hours
**When** I confirm the close
**Then** the confirmed Actual Velocity is locked into Velocity History, the Sprint becomes read-only, and any unfinished Backlog Issue stays in YouTrack, unassigned from any Sprint, until I manually re-pull it later

**Given** a Sprint has already been closed
**When** YouTrack data for one of its issues changes afterward
**Then** the closed Sprint's stored Actual Velocity is not silently overwritten

### Story 4.3: Velocity History and Trend

As a PM,
I want to see Planned and Actual Velocity for every closed Sprint as a trend,
So that my capacity estimates get more accurate over time.

**UX:** UX-DR10, EXPERIENCE.md Component Patterns → Velocity History Trend (table only, no chart in v1 — added to EXPERIENCE.md during this readiness fix since no pattern previously existed for it).

**Acceptance Criteria:**

**Given** at least one closed Sprint
**When** I view Velocity History
**Then** I see that Sprint's Planned Velocity and confirmed Actual Velocity

**Given** multiple closed Sprints
**When** I view Velocity History
**Then** I see them together as a sprint-over-sprint trend

### Story 4.4: Shared Read-Only Team View

As a team member,
I want to view the current Sprint's plan via a shared link without an account,
So that I can check my assignments and the team's status as easily as a shared doc.

**UX:** EXPERIENCE.md Information Architecture → Team View (no nav chrome at all, since there's no session to use it with); [mockup](ux-designs/ux-pm-2026-08-12/mockups/key-team-view.html). Key Flow UJ-3 walks through this exact interaction.

**Acceptance Criteria:**

**Given** the shared Team View link containing its unguessable token
**When** I open it without logging in
**Then** I see the current Sprint's roster, capacity, leave, holidays, and assigned issues

**Given** I am viewing the shared Team View
**When** I look for any way to edit roster, leave, allocations, or the sprint plan
**Then** no such controls exist — the view is read-only, with all write actions unreachable from this route

**Given** the PM's own session and the shared Team View are both open
**When** something changes (e.g. emergency leave logged)
**Then** the Team View reflects the updated Capacity without any separate notification step

## Epic 5: Conversational Query & Reporting Assistant

PM can connect a YouTrack MCP server (separate from the existing REST connection) and ask the Query Assistant natural-language questions — spanning YouTrack data and this app's own domain data — answered with grounded, source-attributed figures, scoped to the PM's own session only.

### Story 5.1: Connect a YouTrack MCP Server

As a PM,
I want to configure a connection to a YouTrack MCP server (server URL, auth token, and the project it should scope to),
So that the Query Assistant has a live, read-only source of YouTrack data to draw answers from.

**Acceptance Criteria:**

**Given** I have an MCP server URL, project, and auth token
**When** I save the connection
**Then** it's stored server-side only (never sent to the client) in a `YouTrackMcpConfig` record, separate from the existing REST `YouTrackConfig`

**Given** I enter an invalid URL, an invalid/expired token, or an unreachable MCP server
**When** I try to save the connection
**Then** a clear inline error is shown and the connection is not saved

**Given** a saved MCP connection
**When** the assistant's tool registry is built from it
**Then** only read/query-capable tools (issue search/read, time-tracking read, project/user/article lookup) are registered — write-capable tools the server exposes (issue create/update, comment, tag, issue-link, article create/update) are never added, from one shared allowlist constant used both for registration and for what's advertised to the LLM

### Story 5.2: Ask the Assistant About YouTrack Data

As a PM,
I want to ask the Query Assistant a natural-language question about YouTrack (e.g. "how many hours did Priya log last sprint"),
So that I get a real answer without navigating to a specific report screen.

**Acceptance Criteria:**

**Given** a saved YouTrack MCP connection (Story 5.1)
**When** I ask the assistant a question answerable from a registered MCP tool
**Then** the answer's figure is inserted by app code from that tool's actual return value — the assistant never states a number the tool call didn't just return

**Given** I ask a question no registered tool can answer (too ambiguous, or would require a write-capable tool)
**When** the assistant responds
**Then** it says it can't answer, rather than guessing

**Given** the MCP server is unreachable or a tool call times out
**When** I ask a question needing it
**Then** the response shows a clear inline error, never a silent wrong answer or an indefinite hang

**Given** I am viewing the app
**When** I look for the assistant
**Then** it's only reachable from my own editing session — no chat entry point exists on the read-only Team View share link

### Story 5.3: Ask the Assistant About This App's Own Data Too

As a PM,
I want to ask the assistant questions that mix YouTrack data with this app's own Capacity/Allocation/Leave/Velocity data (e.g. "how does logged hours compare to planned capacity this sprint"),
So that I don't have to mentally combine two different answers myself.

**Acceptance Criteria:**

**Given** a question spanning both sources
**When** the assistant answers
**Then** each figure in the response is attributed to where it came from (YouTrack MCP vs. this app's computation) — never blended into one unlabeled number

**Given** the question concerns the currently active Sprint
**When** the assistant computes a Capacity/Allocation/Velocity figure
**Then** it's computed live, the same way the Sprint Plan screen would show it

**Given** the question concerns an already-closed Sprint
**When** the assistant answers with a Capacity/Allocation/Velocity figure
**Then** it reads the persisted snapshot recorded at close time, never recomputing live — matching what every other screen already shows for that Sprint
