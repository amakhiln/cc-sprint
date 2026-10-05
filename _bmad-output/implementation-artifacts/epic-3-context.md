# Epic 3 Context: YouTrack Integration & Issue Assignment

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic connects the app to a single YouTrack project so the PM can bring real tracked work into sprint planning instead of retyping it. The PM configures one YouTrack connection, browses that project's open backlog issues read-only, pulls selected issues into the current Sprint (with estimate hours counted against the assignee), assigns each pulled issue to a Team Member, and sees an advisory (never blocking) warning when a person's or the team's assigned hours exceed their computed Capacity. This is what turns the Sprint Plan from a roster exercise into a plan against real work.

## Stories

- Story 3.1: Connect to YouTrack
- Story 3.2: Browse YouTrack Backlog Issues
- Story 3.3: Pull Backlog Issues into a Sprint
- Story 3.4: Assign Issues to Team Members within a Sprint
- Story 3.5: Over-Allocation Warning

## Requirements & Constraints

- The PM configures exactly one YouTrack project connection (instance URL, project, auth token). An invalid URL, invalid/expired token, or unreachable server must surface a clear inline error and must not save.
- Backlog browsing is strictly read-only: no create, edit, comment, or any write-back to YouTrack from this app, even though the MCP server technically supports writes.
- No native "sprint"/agile-board object exists on the YouTrack MCP surface (confirmed directly with the PM) — this app owns all Sprint/board state entirely; nothing about sprint membership is ever synced back to YouTrack.
- Backlog issue browsing shows summary, assignee, priority, and estimate field where available.
- Pulling an issue into a Sprint counts its estimate hours against the assignee's Capacity. If the configured estimate custom field is empty on an issue, the PM must be prompted to enter an hours estimate manually.
- Pulling the same YouTrack issue into two different Sprints over its lifetime must never reuse or overwrite an earlier Sprint's copy — each pull is an independent local record.
- Reassigning a pulled issue to a different Team Member moves its estimate hours to the new assignee's Capacity.
- The over-allocation warning triggers when a Team Member's or the team's assigned issue hours exceed computed Capacity; it is advisory only and must never block assigning issues or closing a Sprint.
- There is no automatic carry-over of unfinished issues between Sprints — every Sprint's backlog pull is a fresh, manual action reflecting current YouTrack state.
- Viewing an already-planned Sprint must never depend on the YouTrack connection being reachable — pulled issue data (title, estimate, assignee) is copied into local storage at pull time, not live-fetched on every view.
- A YouTrack connection problem must surface inline at configuration time, never fail silently.

## Technical Decisions

- All YouTrack access goes through exactly one server-only adapter module wrapping the MCP client SDK (`@modelcontextprotocol/client`, the split client package — not the legacy `@modelcontextprotocol/sdk`). No other module may import that client.
- The adapter is invoked only at three points: backlog browse, pull-into-sprint, and Sprint close (logged-hours pull, covered in Epic 4). It is called only from Server Actions/Route Handlers, never directly from UI.
- Pulling an issue creates a new row scoped to that specific (sprint, YouTrack issue) pair — including title, estimate hours, and assignee — never a single mutable row shared across every Sprint the issue has touched; the sprint reference on that row is never null.
- The YouTrack connection config (instance URL + auth token) lives server-side only in one singleton config row; the token is never sent to the client bundle.
- Over-allocation comparison logic (Capacity vs. assigned hours) lives in the pure `domain/` layer alongside the rest of Sprint logic — never recomputed inline at a UI call site — consistent with this project's rule that all Capacity/Allocation/Velocity math lives in one place to prevent divergence between call sites.
- Server Actions return a discriminated result (`{ok:true,data}` | `{ok:false,error}`) rather than throwing, including for YouTrack connection failures.
- Prisma model names mirror the domain terms exactly (e.g. `BacklogIssue`, `YouTrackConfig`) — no synonyms.

## UX & Interaction Patterns

- **Backlog Drawer**: a right-side slide-over (not a page navigation) opened from an "Add issues" action, using the app's frosted-glass panel treatment (translucent fill, backdrop blur) with an opaque fallback when the user's OS reduces transparency. Lists open issues with search/filtering; selecting stages issues without pulling them yet; a "Pull selected" action commits them, and the drawer stays open afterward for further rounds of selection rather than auto-closing.
- **YouTrack not configured** state: the Backlog Drawer shows a "Connect YouTrack" prompt linking to Settings, instead of an issue list.
- **YouTrack connection error** state: surfaces inline on the Settings connection form itself — never a dismissible toast.
- **Loading** state: skeleton rows in the Backlog Drawer while issues load, to avoid a layout jump.
- **Status Chip** (over-allocation variant): a pill-shaped chip in the app's single designated warning tint, shown inline on the affected Team Member's row and in the team-wide capacity display. It is always advisory — never disables the action it's attached to, and there is only one warning tint used app-wide (no separate color per warning type).
- Issue assignment to a Team Member happens inline both in the Backlog Drawer and on the Sprint Plan's issue rows.

## Cross-Story Dependencies

- Depends on Epic 1: Team Members and a single active Sprint must already exist before issues can be pulled or assigned.
- Depends on Epic 2: the over-allocation warning (Story 3.5) compares assigned issue hours against each Team Member's computed Capacity, which Epic 2 implements.
- Within this epic, work is sequential: a saved connection (3.1) is required before browsing (3.2); browsing precedes pulling issues (3.3); pulling precedes assignment (3.4); assignment is what makes the over-allocation comparison (3.5) meaningful.
- Feeds Epic 4: the Sprint Plan Overview (Story 4.1) displays the issues assigned here, and Sprint close (Story 4.2) pulls Actual Velocity from the same `BacklogIssue` records this epic creates.
