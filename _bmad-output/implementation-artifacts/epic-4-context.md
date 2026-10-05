# Epic 4 Context: Sprint Lifecycle, Velocity Tracking & Team Sharing

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic delivers the PM's single consolidated Sprint Plan view, the sprint-closing workflow that locks in a verified Actual Velocity, the historical velocity trend that makes future capacity estimates more accurate, and the no-login shared view that lets the rest of the team see the current plan. It ties together everything built in Epics 1–3 (roster, capacity, leave/holidays, YouTrack issues) into one screen, and closes the loop from "planned" to "actual" for velocity.

## Stories

- Story 4.1: Sprint Plan Overview
- Story 4.2: Close a Sprint and Confirm Actual Velocity
- Story 4.3: Velocity History and Trend
- Story 4.4: Shared Read-Only Team View

## Requirements & Constraints

- The Sprint Plan Overview is the app's default/home route and single canonical entry surface — roster, per-person Capacity/Allocation breakdown, Leave and Holidays, assigned Backlog Issues, and total planned-vs-available Capacity all appear together, not spread across separate nav destinations.
- Planned Velocity is the total hours committed at Sprint start (sum of planned hours across assigned Backlog Issues). Actual Velocity is pulled automatically from each assigned issue's logged time-tracking hours in YouTrack at Sprint close, then reviewed/edited by the PM before confirming — the confirmed figure, not the raw pull, is what's stored.
- An issue with no logged time must show as an explicit 0, visually distinct from "not yet checked" — never ambiguous between the two.
- Closing a Sprint locks the confirmed Actual Velocity into Velocity History and flips the Sprint to read-only; any later change to that issue's data in YouTrack must never silently overwrite the already-closed Sprint's stored figure.
- Unfinished Backlog Issues at close are left unassigned in YouTrack — no automatic carry-over into the next Sprint; the PM re-pulls manually when planning the next one.
- Velocity History shows every closed Sprint's Planned and Actual Velocity together as a sprint-over-sprint trend, most recent first.
- The shared Team View is reached via one standing, unguessable link token (not per-Sprint, not rotating) and always reflects whichever Sprint is currently active. It requires no login and exposes zero write controls — any change the PM makes (e.g. emergency leave) must appear there without a separate notification step, since the view is pull-based, not push.
- No authentication exists anywhere in this product: the PM's own editing surface is protected only by trusted network placement, and the Team View's only protection is the unguessable token — treat that as defense-in-depth, not real access control.
- v0 hosting note: the app runs on the PM's own laptop, so the shared Team View link only works while that laptop is on and reachable — a known, accepted limitation, not something to solve in this epic.

## Technical Decisions

- All Capacity/Allocation/Velocity math is computed by pure `domain/` functions with no framework/ORM/MCP imports; Sprint Plan Overview and Sprint Close both call into this shared logic rather than recomputing anything inline.
- An active Sprint's Capacity and Velocity are always computed live from current roster/allocation/leave/holiday state on every read. Closing a Sprint snapshots the computed Capacity, the full allocation breakdown, and the confirmed Actual Velocity onto persisted fields on the Sprint record — a closed Sprint's stored numbers are read directly afterward and never recomputed, even if roster/allocation data changes later.
- Removing a Team Member is a soft delete, so closed-Sprint snapshots and historical issue-assignee references stay intact after the fact.
- A Backlog Issue's logged-hours pull timestamp is tracked separately from the logged-hours value itself, so "0 hours confirmed" is distinguishable from "not yet pulled."
- All YouTrack access (including the Sprint-close logged-hours pull) goes through one server-only adapter module; the connection token never reaches the client bundle.
- The shared Team View route may import only read-side domain/query functions — no code path reachable from that route may import a write-capable Server Action. This is a structural rule, not just a UI convention.
- Single-active-Sprint enforcement (from Epic 1) means closing a Sprint is also the only way to unblock creating the next one.

## UX & Interaction Patterns

- Sprint Plan Overview is the default/home route; Velocity History, the Backlog Drawer, and Close Sprint are all reached contextually from it rather than via separate top-level nav items.
- Capacity Ledger: a team-wide instance at the top of Sprint Plan plus a smaller per-row instance in the roster table, recalculating live with no manual refresh; selecting/expanding it reveals the per-category hours breakdown.
- Sprint Close Flow is a modal (never a full-page navigation): each assigned issue's auto-pulled Actual Velocity shown editable inline, with a running total and a single confirm action. An issue with no logged time shows a distinct "not yet checked" state rather than a bare 0.
- A closed Sprint renders with edit affordances entirely absent (not merely disabled) across every surface touching its data, so it visually reads as history rather than a locked form.
- Velocity History is a single table (Sprint / Planned Velocity / Actual Velocity / delta) using tabular-figure alignment, most recent Sprint first — no chart in v1.
- Team View (`/share/[token]`) renders the same Sprint Plan information read-only with no nav chrome at all, since a team member there has no session for such links to use.
- Status is never color-only (labels accompany every chip), and the Capacity Ledger's animated recalculation must respect `prefers-reduced-motion` (instant update, no animated transition).

## Cross-Story Dependencies

- Story 4.1 depends on Epic 1 (roster, allocation), Epic 2 (capacity, leave/holidays), and Epic 3 (assigned Backlog Issues) all being in place — it is purely an aggregation view over existing domain data.
- Story 4.2 (close) depends on Epic 3's issue-assignment data to know which issues to pull logged hours for, and its outcome (locked Velocity History entry) feeds Story 4.3.
- Story 4.4 depends on Story 4.1's data shape (it renders the same information, read-only) and on the AD-4 route isolation rule being respected by whatever Story 4.1 builds.
- Closing a Sprint (4.2) is also what allows a new Sprint to be created (Epic 1's single-active-Sprint rule), so it is a lifecycle gate for the next planning cycle, not just a velocity-recording action.
