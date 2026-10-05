---
name: 'Sprint & Velocity Planner'
status: final
created: '2026-08-12'
updated: '2026-08-17'
amended: '2026-08-17 (updated cross-references for DESIGN.md''s full identity rework: universal glassmorphism, new category-color palette, dropped Data face; added cursor:pointer convention to Interaction Primitives)'
sources: ['_bmad-output/planning-artifacts/prds/prd-pm-2026-08-12/prd.md', '_bmad-output/planning-artifacts/architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md', '_bmad-output/specs/spec-sprint-velocity-planner/SPEC.md', '_bmad-output/planning-artifacts/epics.md']
companions: ['DESIGN.md']
---

# EXPERIENCE.md — Sprint & Velocity Planner

## Foundation

**Form factor:** web, desktop-primary. `[ASSUMPTION]` The PM's editing surface targets desktop/laptop browsers (their daily work tool); the read-only Team View is desktop-primary too — see Responsive & Platform for behavior at narrower widths.

**UI system:** shadcn/ui (Radix primitives + Tailwind), matching the Next.js/Tailwind stack already fixed in the Architecture Spine. DESIGN.md's tokens override shadcn's default theme (color, radius, font) without replacing its component behavior.

**Visual identity reference:** DESIGN.md. This file owns behavior, state, and flow; DESIGN.md owns how it all looks. DESIGN.md wins on any visual conflict.

## Information Architecture

Minimal navigation — this is a single-PM tool with one live Sprint, not a multi-section app:

- **Sprint Plan** (default/home route) — the Sprint Plan Overview: Capacity Ledger, roster capacity table, Leave/Holidays, assigned Backlog Issues, planned-vs-available. Everything else is reached *from* here, contextually, rather than via a separate nav item — matching FR22's "one screen" intent.
- **Roster** — Team Member list, Allocation Category management, per-person Allocation %, Working Hours, and Leave editing (see Team Member Detail Panel, Component Patterns).
- **Velocity History** — the sprint-over-sprint trend view.
- **Settings** — YouTrack connection configuration (FR16) and Holiday management (FR8) as two distinct sections.
- **Backlog** (contextual drawer, not a nav item) — opened from an "Add issues" action on Sprint Plan; lets the PM browse and pull YouTrack Backlog Issues (FR17/FR18) without leaving the Sprint Plan context.
- **Close Sprint** (contextual modal, not a nav item) — opened from a "Close Sprint" action on Sprint Plan; confirms Actual Velocity (FR14/FR23).
- **Team View** (`/share/[token]`) — a separate, unauthenticated route. Renders the same Sprint Plan information read-only; no nav chrome at all (no links back into the PM's app), since a team member reaching this route has no session those links would require. See [mockups/key-team-view.html](mockups/key-team-view.html).

## Voice and Tone

Plain, direct, active voice — named after what the PM controls, never how the system is built ("Add team member," not "Create record"). A button's label and its confirmation match exactly: "Close Sprint" → "Sprint closed." Errors state what happened and what to do, without apology: "Couldn't connect to YouTrack — check the URL and token" rather than "Something went wrong." Empty states are invitations, not dead ends: an empty roster reads "No team members yet — add your first one to start planning," not "No data." Brand voice/aesthetic posture itself lives in DESIGN.md's Brand & Style section; this section governs only the words.

## Component Patterns

*(Behavioral specs — visual treatment is DESIGN.md's Components section.)*

- **Capacity Ledger:** recalculates live on every relevant change (leave entered, allocation edited, issue assigned) — no manual refresh. Team-wide instance sits at the top of Sprint Plan; a smaller per-person instance appears in each roster row. Selecting or expanding it reveals the Allocated Hours breakdown by category (FR13). See [mockups/key-sprint-plan-overview.html](mockups/key-sprint-plan-overview.html).
- **Status Chip:** one per Leave type, Holiday, and the over-allocation warning. The over-allocation chip is always advisory — it is never a blocking element and never disables the action it's attached to (FR19).
- **Backlog Drawer:** a right-side slide-over opened from Sprint Plan's "Add issues" action. Lists the configured YouTrack Project's open issues with search and filtering; selecting issues stages them (not yet pulled); a "Pull selected" action commits them into the Sprint and the drawer stays open for further selection rather than auto-closing, since pulling issues is typically a multi-round action. See [mockups/key-backlog-drawer.html](mockups/key-backlog-drawer.html).
- **Sprint Close Flow:** a modal, not a full-page navigation. Lists each assigned issue with its auto-pulled Actual Velocity hours (editable inline), a running total, and a single "Confirm and close" action. An issue with no logged time shows a distinct "not yet checked" state (see State Patterns), not a bare 0.
- **Allocation % Editor:** an inline-editable row per category with a live running-sum indicator next to the 100% target. The indicator turns from neutral to `signal-warning` (DESIGN.md) the moment the sum drifts off 100%, matching FR4's warn-not-block behavior.
- **Team Member Detail Panel:** opened from a Roster row (or the roster table on Sprint Plan). Hosts the Allocation % Editor, an editable Working Hours field (FR5), and a "Log Leave" action that opens the Leave Entry form for that Team Member. This is the single home for everything specific to one person, so UJ-2's "opens that Team Member's row and logs Emergency Leave" always resolves to the same place regardless of which screen it was opened from. See [mockups/key-team-member-detail.html](mockups/key-team-member-detail.html) (also shows the FR4 warn-not-block state).
- **Leave Entry:** a small form (popover or modal) reached from the Team Member Detail Panel — a date range picker and a toggle for Planned or Emergency leave type (FR6/FR7). Saving applies immediately; there is no separate "review before save" step, matching FR7's "recalculates immediately" requirement for Emergency Leave.
- **Holiday Manager:** lives in Settings, not per-Team-Member, since a Holiday applies to everyone at once (FR8). A simple list of existing Holidays plus an "Add Holiday" date-range control — no per-person selection exists here by design, reinforcing that a Holiday is company-wide.
- **Allocation Category Manager:** lives on Roster, alongside the Team Member list. A flat list of category names the PM can add, rename, or remove (FR3). Renaming updates the label everywhere it's referenced, including every Team Member's existing Allocation % Editor rows; removing a category currently assigned to a Team Member is blocked until the PM reassigns that percentage elsewhere first.
- **Velocity History Trend:** a single table — Sprint, Planned Velocity, Actual Velocity, delta — in the Display face (DESIGN.md's `{components.data-figure}`) with tabular-number alignment throughout, most recent Sprint first (FR15). `[NOTE FOR UX]` No chart in v1; a handful of closed Sprints reads fine as a table, and a sparkline is easy to add later once enough history exists to make one worth reading.

## State Patterns

- **Empty roster:** invitation to add the first Team Member (Voice and Tone example above).
- **No active Sprint:** Sprint Plan shows an invitation to create one (Story 1.7) instead of an empty table.
- **YouTrack not configured:** the Backlog Drawer shows a "Connect YouTrack" prompt linking to Settings instead of an issue list.
- **YouTrack connection error:** surfaces inline on the Settings form itself (FR16's testable consequence) — never a toast that can be missed.
- **Loading:** skeleton rows for the Roster, Backlog Drawer, and Velocity History tables — preserves layout and avoids a content jump once data arrives, important given how data-dense these views are.
- **Over-allocation:** advisory chip inline on the affected Team Member's row and in the team-wide Capacity Ledger; never disables assigning further issues or closing the Sprint (FR19).
- **Closed Sprint:** renders with no edit affordances at all — not disabled inputs, but their absence — so a closed Sprint visually reads as history, not as a locked form. Reinforces the Architecture Spine's AD-2 immutability rule.
- **Actual Velocity "0 vs. not-yet-checked":** an issue with genuinely 0 logged hours shows "0h logged"; an issue never pulled shows "Not yet checked" in muted italics — visually and textually distinct so the PM never mistakes one for the other (FR14).

## Interaction Primitives

- **Inline validation:** the Allocation % running-sum indicator updates as the PM types, before save.
- **Optimistic updates:** quick actions (adding a Leave entry, toggling a category) apply immediately in the UI and roll back with an inline error if the underlying Server Action returns `{ok:false}` (Architecture Spine convention).
- **Keyboard-first tables:** Roster and Velocity History tables support arrow-key and Tab-key navigation between rows, since the PM is a frequent, desktop-based user of this screen.
- **Confirm-before-destructive:** Remove Team Member and Close Sprint both require a lightweight confirmation dialog (not a full-page interstitial) — both are consequential and awkward to casually undo.
- **Pointer affordance:** every interactive element — buttons, links, clickable rows/rows that open a panel, chips that act as toggles — shows `cursor: pointer` on hover, with no exceptions. Disabled controls are the one exception, showing `cursor: not-allowed` instead.

## Accessibility Floor

- WCAG AA contrast minimum for every text-to-background color pairing in DESIGN.md's palette against the frosted-glass fill (not just the flat canvas color) — glass panels sit at variable effective opacity over the gradient mesh, so contrast must be verified against the busiest realistic backdrop, not just a clean swatch.
- Visible keyboard focus rings (accent-colored) on every interactive element; drawers and modals trap focus while open and return it to the triggering element on close.
- Status is never color-only: every chip carries a text label, not just a color, so the Capacity Ledger's per-category segments and the warning tint remain legible to users with color vision deficiencies.
- The Capacity Ledger's fill animation (DESIGN.md) respects `prefers-reduced-motion` — recalculation still updates instantly, just without the animated transition.

## Responsive & Platform

Desktop-primary per Foundation. The app must remain usable (not necessarily optimized) down to a narrower browser window, since nothing prevents the PM or a team member from resizing a window or opening the Team View on a phone browser — but no dedicated mobile layout or touch-specific interaction pattern is designed for v1. `[NOTE FOR UX]` Revisit if team members regularly check the Team View on mobile in practice.

## Key Flows

*(Names mirror the PRD's User Journeys verbatim — UJ-1, UJ-2, UJ-3.)*

- **UJ-1. Akhil plans the next two-week sprint.**
  Akhil opens Sprint Plan, confirms allocations on Roster, logs any known leave, then opens the Backlog Drawer and pulls issues, assigning each to a Team Member. He watches the team-wide Capacity Ledger update live with every assignment. **Climax:** the Ledger's category segments sit safely under the total — no warning-colored overage — and he confidently closes the drawer before the sprint starts. The Team View link is already live; nothing further to do.

- **UJ-2. An emergency leave hits mid-sprint.**
  Akhil opens that Team Member's row and logs Emergency Leave for the remaining days. **Climax:** the Capacity Ledger visibly animates as it shrinks in real time — the moment that proves the tool's math is live, not a static snapshot — and he can immediately see whether an assigned issue now needs descoping.

- **UJ-3. Priya checks the sprint plan.**
  Priya opens the shared Team View link on her laptop. **Climax:** no login prompt, no edit affordances anywhere — just the same Capacity Ledger and her own assignments, rendered exactly as the PM sees them (minus the ability to touch anything). She closes the tab with nothing left to confirm.
