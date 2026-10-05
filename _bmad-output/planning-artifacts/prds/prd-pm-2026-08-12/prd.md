---
title: Sprint & Velocity Planner
status: final
created: 2026-08-12
updated: 2026-08-25
amended: 2026-08-12 (architecture phase — FR-24 hosting limitation noted); 2026-08-25 (added §4.7 Conversational Query & Reporting Assistant, FR-25–FR-28)
---

# PRD: Sprint & Velocity Planner
*Working title — confirm.*

## 0. Document Purpose

This PRD defines an internal sprint-planning tool for a single team, used solely by the Product Manager (PM) to plan capacity, allocation, leave, and velocity for two-week sprints. It also includes a read-only view that team members use to see the plan. It is written for the PM (as both requester and sole editor) and for the downstream architecture and epics/stories work that will follow. Terms are Glossary-anchored (§3). Functional Requirements are grouped by feature (§4) and numbered globally (FR-1, FR-2, ...). Inferred details are tagged `[ASSUMPTION]` inline and indexed in §9. Technology choices (Next.js, MCP client details) are recorded in `addendum.md`, not here.

## 1. Vision

Sprint capacity today is guessed, not calculated — a PM eyeballs who's available, how much of their time is actually dev work versus meetings and planning, and who's on leave, then hopes the sprint plan holds. This tool makes that math explicit: every team member's time is split across allocation categories (dev, management, devops, planning, etc.) as a percentage, leave (planned or emergency) is subtracted from their available hours, and the result is a real capacity number the PM can plan a two-week sprint against. It pulls in actual backlog work from YouTrack rather than a spreadsheet copy of it. Over time, the tool also tracks how planned velocity compares to actual, so allocation and capacity assumptions improve sprint over sprint.

## 2. Target User

### 2.1 Jobs To Be Done
- As the PM, I need to know the *real* available hours for my team this sprint, not headcount × 80 hours, so my sprint commitments are realistic.
- As the PM, I need to see the effect of a sudden emergency leave on the current sprint's capacity immediately, so I can rebalance without redoing the math by hand.
- As the PM, I need to pull real backlog issues from YouTrack into the plan, so the sprint plan reflects actual tracked work, not a duplicate list.
- As the PM, I need to compare planned vs. actual velocity across past sprints, so my capacity estimates get more accurate over time.
- As a team member, I need to see the current sprint plan (my assigned work, who's out, team capacity) without needing an account, so I can check it as easily as a shared doc.

### 2.2 Non-Users (v1)
- Other PMs or teams (multi-team / multi-tenant use) — this is scoped to one PM, one team.
- Team members as *editors* — they view only; they do not log in, submit leave, or update issues in this tool in v1.
- Company HR/payroll — leave tracked here affects sprint capacity math only, not any system of record for leave balances.

### 2.3 Key User Journeys

- **UJ-1. Akhil plans the next two-week sprint.**
  - **Persona + context:** Akhil, the PM, sits down the Friday before a new sprint starts.
  - **Entry state:** No login required — this is his own tool. He opens the app to the team roster.
  - **Path:** He confirms each team member's allocation % (dev/mgmt/devops/etc.) is current, enters any planned leave he already knows about, and opens the YouTrack backlog browser for the project. He selects issues into the new sprint, watching the "planned hours vs. available capacity" indicator per person and for the team as a whole.
  - **Climax:** The plan screen shows total planned hours safely under total capacity, with no one over-allocated — Akhil is confident before committing.
  - **Resolution:** He starts the sprint. The read-only share link is already live for the team to check.
  - **Edge case:** If planned hours exceed a person's capacity, the UI flags it before he finalizes, so over-commitment is a visible choice, not a surprise later.

- **UJ-2. An emergency leave hits mid-sprint.**
  - **Persona + context:** Three days into the sprint, a team member calls in sick for the rest of the week.
  - **Entry state:** Akhil is mid-sprint, plan already committed.
  - **Path:** He opens that member's record and logs emergency leave for the remaining days. The system recalculates that member's remaining capacity and the team total.
  - **Climax:** The updated capacity number is visible immediately, so Akhil can decide whether to descope an assigned issue.
  - **Resolution:** The read-only view team members see reflects the new capacity without Akhil needing to notify anyone separately.

- **UJ-3. Priya checks the sprint plan.**
  - **Persona + context:** Priya, a developer on the team, wants to see what's assigned to them and who else is out this sprint.
  - **Entry state:** No account. They open the shared read-only link.
  - **Path:** They see the current sprint's roster, capacity, leave, and assigned issues.
  - **Climax:** They confirm their own assignments and see the team is tracking under capacity.
  - **Resolution:** They close the tab — no edits possible, nothing to confirm back.

- **UJ-4. Akhil asks the assistant instead of digging through screens.**
  - **Persona + context:** Akhil is mid-planning and wants a quick answer without navigating to a specific report screen.
  - **Entry state:** He's anywhere in his own session; the chat assistant is one click away.
  - **Path:** He types a plain-language question — "how many hours did Priya log last sprint," or "what's the team's allocation breakdown this sprint" — mixing a YouTrack fact with an app-internal one in the same conversation if needed.
  - **Climax:** The assistant answers with the real number, sourced from an actual query (a YouTrack time-tracking lookup or this app's own Capacity calculation), not a guess.
  - **Resolution:** Akhil trusts the figure because he can see what it was drawn from, and moves on without breaking his planning flow.
  - **Edge case:** If YouTrack is unreachable or the question can't be grounded in real data, the assistant says so plainly instead of answering anyway.

## 3. Glossary

- **Team Member** — a person on the roster who can be given Allocation Categories, Leave, and assigned Backlog Issues. Added and removed by the PM.
- **Allocation Category** — one of a shared, PM-configured list of categories (e.g. Dev, Management, DevOps, Planning) used to split every Team Member's working time. The list is maintained once by the PM and reused across all Team Members.
- **Allocation %** — the percentage of a Team Member's total working time assigned to one Allocation Category. A Team Member's Allocation %s across all their Allocation Categories sum to 100%.
- **Sprint** — a fixed-length planning period, defaulting to two weeks, with a start date and end date, during which Team Members work against assigned Backlog Issues.
- **Working Hours** — the hours per working day a Team Member is nominally available (before Allocation % or Leave/Holiday are applied).
- **Planned Leave** — Leave entered by the PM for a Team Member ahead of or at the start of a Sprint, known in advance.
- **Emergency Leave** — Leave entered by the PM for a Team Member during an active Sprint, unplanned at sprint start.
- **Holiday** — a company-wide non-working date (or date range) marked by the PM, applying to all Team Members at once and reducing Capacity the same way Leave does, without being tied to one individual.
- **Capacity** — the Dev-allocated hours a Team Member (or the team, summed) has available in a Sprint, computed from Working Hours × Dev Allocation % over the Sprint's working days, minus hours lost to Leave and Holidays.
- **Planned Velocity** — total Capacity committed against at Sprint start (i.e., total planned hours across assigned Backlog Issues).
- **Actual Velocity** — logged time-tracking hours on assigned Backlog Issues actually completed by Sprint close, pulled from YouTrack.
- **Velocity History** — the sequence of Planned Velocity and Actual Velocity values across completed Sprints, used to show trend.
- **YouTrack Project** — the single project configured in the YouTrack MCP Integration (v1 supports one Project, not multiple).
- **Backlog Issue** — an issue belonging to the YouTrack Project, pulled in read-only via the YouTrack MCP Integration and available to assign into a Sprint.
- **YouTrack MCP Integration** — the connection from this app to a YouTrack instance's MCP server, used to browse Projects and Backlog Issues.
- **Query Assistant** — the chat interface (§4.7) the PM uses to ask natural-language questions answered from real data — either a read-only YouTrack MCP query or this app's own domain data (Capacity, Allocation, Leave, Velocity).

## 4. Features

### 4.1 Team Roster & Allocation

**Description:** The PM maintains the list of Team Members and, for each, how their time splits across Allocation Categories. This is the base input every Capacity calculation depends on. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Add Team Member
PM can add a Team Member with a name and default daily Working Hours.

**Consequences (testable):**
- New Team Member appears on the roster immediately and is available for Allocation, Leave, and Sprint assignment.

#### FR-2: Remove Team Member
PM can remove a Team Member from the active roster.

**Consequences (testable):**
- Removed Team Member no longer appears for new Sprint assignment or Leave entry.
- Their Capacity and Velocity contribution in past, already-closed Sprints remains visible in Velocity History (removal is not retroactive deletion).

#### FR-3: Configure shared Allocation Category list
PM maintains one shared list of Allocation Categories (add, rename, remove) reused across the whole team.

**Consequences (testable):**
- Renaming a category updates its label everywhere it's used; removing a category in use by a Team Member requires reassigning that % first.

#### FR-4: Assign Allocation % per Team Member
PM assigns each Team Member a % of their time across one or more categories from the shared list (FR-3), validated to sum to 100% for that Team Member.

**Consequences (testable):**
- Saving is allowed even if a Team Member's Allocation %s do not sum to 100%. The system shows a clear warning both at save time and anywhere that Team Member's Capacity is displayed, so an incomplete breakdown is never mistaken for a deliberate 100% split.

#### FR-5: Edit Allocation % and Working Hours
PM can change a Team Member's Allocation % breakdown and/or default Working Hours at any time.

**Consequences (testable):**
- Changes apply to the current and future Sprints only; a closed Sprint's recorded Capacity is not recalculated retroactively.

### 4.2 Leave & Holidays

**Description:** The PM records Planned Leave, Emergency Leave, and company-wide Holidays; all three reduce Capacity for the affected Sprint — leave for one Team Member, Holidays for everyone. Realizes UJ-2.

**Functional Requirements:**

#### FR-6: Record Planned Leave
PM can enter a date range of Planned Leave for a Team Member, overlapping a current or future Sprint.

**Consequences (testable):**
- The affected Sprint's Capacity for that Team Member recalculates to reflect the leave days.

#### FR-7: Record Emergency Leave
PM can enter a date range of Emergency Leave for a Team Member at any point, including mid-Sprint after it has started.

**Consequences (testable):**
- Recalculation happens immediately and is reflected on the read-only Team View (FR-24) without further action.

#### FR-8: Record Holiday / Office Closure
PM can mark a date (or date range) as a Holiday, applying to all Team Members at once, the same way individual Leave applies to one.

**Consequences (testable):**
- A Holiday date reduces every Team Member's Capacity for that Sprint by their Working Hours × Dev Allocation % for that day, without needing a separate Leave entry per person.

#### FR-9: Leave and Holidays reduce Capacity proportionally
System reduces a Team Member's Capacity for a Sprint by (distinct working days lost × Working Hours × their Dev Allocation %), where "distinct working days lost" is the count of Sprint working days covered by that Team Member's Leave and/or a Holiday — a calendar day counts once even if both a Leave range and a Holiday land on it, and weekend/non-working days within a Leave range are never counted (they were never part of Capacity to begin with).

**Consequences (testable):**
- A Team Member with 2 days of Leave plus 1 company Holiday, none overlapping, in a 10-working-day Sprint, 8 Working Hours/day, and 60% Dev allocation loses 3 × 8 × 0.6 = 14.4 hours of Capacity.
- If that same Team Member's Leave range happens to include the Holiday date, the Holiday day is not counted twice — still 3 distinct days lost, not 4.
- If a Team Member's Leave range spans a weekend, the weekend days are excluded from the day-count entirely.

#### FR-10: View Leave and Holidays by Team Member and Sprint
PM can see all Leave entries (Planned and Emergency, type distinguished) for a Team Member, and all Holidays, within a given Sprint.

**Consequences (testable):**
- Each entry displays its type (Planned Leave, Emergency Leave, or Holiday) and date range, distinguishable at a glance.

### 4.3 Capacity & Velocity Calculation

**Description:** The system turns roster, allocation, and leave data into a Capacity number per Team Member and per team, and tracks how that compares to what actually got done. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-11: Compute per-person Capacity
System computes each Team Member's Capacity for a Sprint as: Sprint working days × Working Hours × Dev Allocation % − hours lost to Leave and Holidays (FR-9).

#### FR-12: Compute team Capacity
System sums per-person Capacity (FR-11) into a total team Capacity for the Sprint.

#### FR-13: View Allocated Hours breakdown
PM can view each Team Member's hours broken down by Allocation Category (e.g. how many hours go to Management vs. Dev vs. DevOps), plus a team-wide total per category, for the current Sprint.

**Consequences (testable):**
- Leave and Holiday reduction (FR-9) applies uniformly across all of a Team Member's Allocation Categories for the affected days, not only their Dev category — a day off is a day off from Management and DevOps time too, not just Dev Capacity. The Dev Allocation Category's post-reduction figure is what Capacity (§3 Glossary) refers to elsewhere in this document.

#### FR-14: Track Planned vs. Actual Velocity
System records Planned Velocity at Sprint start (sum of planned hours on assigned Backlog Issues). At Sprint close, System pulls Actual Velocity automatically from completed Backlog Issues' **logged time-tracking hours** via the YouTrack MCP Integration, and the PM reviews and can adjust the pulled hours before the Sprint is locked in.

**Consequences (testable):**
- Sprint close (FR-23) shows the auto-pulled Actual Velocity figure — editable — per issue and in total, before confirming close.
- Once closed, the confirmed Actual Velocity is what's stored in Velocity History (FR-15) — not silently overwritten by a later YouTrack change.
- An issue with no logged time pulls as 0 hours, clearly distinguished from "not yet checked," so the PM knows to fill it in manually rather than mistaking it for a real zero.

**Notes:**
- `[NOTE FOR PM]` This requires the team to log time against issues in YouTrack — a new operational dependency, since nothing else in this PRD assumes team members use YouTrack's time-tracking. If that habit isn't already in place, Actual Velocity will come back mostly empty until it is, and SM-2 (§7) will have no real data to measure against. Worth confirming this is realistic for your team before build starts.

#### FR-15: Velocity History and trend
System retains Planned Velocity and Actual Velocity for every closed Sprint and displays them as a sprint-over-sprint trend.

### 4.4 YouTrack Integration (via MCP)

**Description:** The PM connects the app to YouTrack so Backlog Issues can be pulled into sprint planning instead of re-entered by hand. Realizes UJ-1.

**Functional Requirements:**

#### FR-16: Connect to YouTrack
PM can configure a connection to one YouTrack Project via that instance's MCP server (instance URL, project, and auth token). v1 supports a single configured YouTrack Project, not multiple.

**Consequences (testable):**
- An invalid URL, invalid/expired token, or unreachable server surfaces a clear inline error and does not save the connection.

#### FR-17: Browse YouTrack Backlog Issues
PM can view the configured YouTrack Project's open Backlog Issues (summary, assignee, priority, and relevant custom fields such as estimate).

**Out of Scope:**
- `[ASSUMPTION]` Read-only in v1 — the app does not create, update, comment on, or otherwise write back to YouTrack issues, even though the MCP server supports it. Issue authoring stays in YouTrack.
- `[UNVERIFIED — docs only]` No native "sprint" or agile-board object exists on the YouTrack MCP surface, per JetBrains' documentation page — this has not been confirmed against a live MCP server's actual tool list. Sprint membership and board state (§4.5) are assumed to be owned entirely by this app, never synced back to YouTrack; re-verify against a running MCP server before architecture commits to that boundary.
- No automatic carry-over: Backlog Issues left unfinished at Sprint close are not auto-added to the next Sprint. The PM re-pulls from YouTrack (FR-17) each time a new Sprint is planned, so the pull always reflects current YouTrack state.

#### FR-18: Assign Backlog Issues into a Sprint
PM can pull selected Backlog Issues into the current Sprint plan, with each issue's estimate hours counted against the assignee's Capacity.

**Consequences (testable):**
- `[ASSUMPTION]` Estimate hours are read from one configurable YouTrack custom field (e.g. "Estimation"), consistent since v1 only connects to a single Project (FR-16); if the field is absent on a given issue, the PM enters an hours estimate manually for that issue in-app.

#### FR-19: Over-allocation warning
System flags when a Team Member's or the team's planned issue hours exceed their computed Capacity for the Sprint.

**Consequences (testable):**
- The flag is advisory only — it never blocks assigning an issue or finalizing the Sprint. Over-committing is a visible choice the PM can make deliberately (realizes UJ-1's edge case), not a hard stop.

### 4.5 Sprint Planning

**Description:** The single working screen where the PM assembles a Sprint from roster, capacity, leave, and YouTrack Backlog Issues. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-20: Create a Sprint
PM can create a new Sprint with a start date and length, defaulting to two weeks (editable).

**Consequences (testable):**
- Exactly one Sprint is active at a time — the PM cannot create a new Sprint while one is still open; it must be closed (FR-23) first.

#### FR-21: Assign issues to Team Members within a Sprint
PM can assign each selected Backlog Issue (FR-18) to a specific Team Member within the Sprint.

#### FR-22: Sprint Plan overview
PM can view, on one screen: roster, per-person Capacity and Allocation breakdown, Leave and Holidays, assigned Backlog Issues, and total planned vs. available Capacity.

#### FR-23: Close a Sprint
PM reviews and confirms/adjusts the auto-pulled Actual Velocity (FR-14), then closes the active Sprint, which locks that figure into Velocity History (FR-15) and marks the Sprint read-only going forward. Any Backlog Issue left unfinished stays in YouTrack, unassigned from any Sprint, until manually re-pulled (FR-17).

### 4.6 Read-Only Team View

**Description:** The one thing team members interact with — seeing the current plan. Realizes UJ-3.

**Functional Requirements:**

#### FR-24: Shared read-only Sprint Plan view
Any team member can view the current Sprint's plan (roster, capacity, leave, holidays, assigned issues) via a shared link containing an unguessable token, with no login and no edit controls.

**Consequences (testable):**
- All write actions (Sections 4.1–4.5) are unavailable from this view; only the PM's authenticated/local session can edit. `[ASSUMPTION]` "no authentication" for the PM's own session means the app is only exposed on a network the team already trusts (e.g. internal/VPN), not the public internet — see §5 Non-Goals and the addendum's network consideration.
- The share link's token is long and unguessable (not a sequential or predictable ID), as a baseline safeguard against the link being stumbled onto — it is not a substitute for the trusted-network assumption above, only cheap defense-in-depth alongside it.

**Notes:**
- `[NOTE FOR PM]` **v0 hosting limits this FR.** The architecture spine (`_bmad-output/planning-artifacts/architecture/architecture-pm-2026-08-12/`) has the app running on the PM's own laptop for v0, with only the database hosted in the cloud (Supabase). That means this shared link only works while the laptop is on and network-reachable — it does not yet deliver "team can check the plan anytime." Revisit once always-on hosting (Deferred in the spine) is addressed; until then, treat FR-24 as functionally limited rather than fully met.

### 4.7 Conversational Query & Reporting Assistant (Chat)

**Description:** A chat interface where the PM asks natural-language questions and gets answers grounded in real data — pulled live and read-only from the YouTrack MCP server, or computed from this app's own domain data (Capacity, Allocation, Leave, Velocity, Sprints). It never performs write actions and is never guessing at a figure. Realizes UJ-4.

**Functional Requirements:**

#### FR-25: Ask a natural-language question, get a grounded answer
PM can type a natural-language question — e.g. "how many hours did Priya log last sprint," "what's the team's allocation breakdown this sprint," "what's still open in the backlog" — and receive an answer computed from real data, not a fabricated figure.

**Consequences (testable):**
- Every numeric or factual answer traces back to an actual query result (a YouTrack MCP call or an app domain computation), shown alongside the answer so the PM can see what it was drawn from.
- If the question can't be grounded in real data (too ambiguous, no matching capability), the assistant says so rather than guessing.

#### FR-26: Read-only enforcement at the tool layer
The assistant is only ever given read/query-capable YouTrack MCP tools (issue search/read, time-tracking read, project/user/article lookup). Write-capable MCP tools (create/update issue, comment, log time) are never made available to it — the same enforcement approach FR-17 already applies to backlog browsing.

**Consequences (testable):**
- No prompt, however phrased, can cause a write back to YouTrack through this feature, because the write-capable tools are absent from what the assistant can call — not merely discouraged by instruction.

#### FR-27: Cross-source queries spanning YouTrack + app domain data
PM can ask a question that combines both data sources in one query (e.g. "how does logged hours compare to planned capacity for the current sprint").

**Consequences (testable):**
- The assistant attributes each figure to its actual source (YouTrack logged time vs. this app's computed Capacity) rather than conflating them into one number.

#### FR-28: Chat scoped to the PM's own session
The assistant is available only within the PM's own editing session, not on the anonymous read-only Team View (FR-24).

**Consequences (testable):**
- No chat entry point, endpoint, or route is reachable from the `/share/[token]` view.

**Notes:**
- `[ASSUMPTION]` A connection failure or timeout mid-query surfaces as a clear inline message in the chat (consistent with FR-16's connection-error handling), never a silent wrong answer or an indefinite hang.

## 5. Non-Goals (Explicit)

- Not a replacement for YouTrack — issue creation, editing, and workflow stay in YouTrack; this app only reads Backlog Issues in.
- Not a multi-team or multi-PM tool in v1 — one team, one PM, one roster.
- Not a system of record for HR/payroll leave balances — Leave here exists only to adjust sprint Capacity math.
- No team-member accounts, login, or self-service (no submitting their own leave, no editing assignments) in v1.
- No mobile app — single responsive web app (Next.js, per addendum).
- No notifications (email/Slack/etc.) in v1 — the read-only view is pull, not push.

## 6. MVP Scope

### 6.1 In Scope
- Team roster: add/remove Team Members; one shared, PM-configurable Allocation Category list; per-person Allocation % across it.
- Planned Leave, Emergency Leave, and company-wide Holiday entry, all affecting Capacity.
- Capacity and Velocity (Planned/Actual) calculation, in hours.
- Velocity History across closed Sprints.
- YouTrack MCP Integration: connect to one Project, browse its Backlog Issues, pull into Sprint (read-only), manual re-pull each Sprint (no auto carry-over).
- Sprint creation (default 2 weeks, editable), issue assignment, one-screen Sprint Plan view, advisory over-allocation warning, Sprint close with PM-confirmed Actual Velocity.
- No-login, token-linked read-only shared Team View. `[NOTE FOR PM]` Limited in v0 by hosting: see FR-24's note — works only while the PM's laptop is on/reachable, until always-on hosting is revisited.
- Conversational Query Assistant (§4.7): natural-language, read-only chat over YouTrack MCP data and this app's own domain data, scoped to the PM's session only.

### 6.2 Out of Scope for MVP
- Multi-team / multi-PM support — deferred, revisit if a second team asks.
- Team-member self-service (accounts, own leave submission, assignment acceptance) — deferred to v2.
- Writing back to YouTrack (status updates, comments) — deferred; MCP server supports it, but no current need.
- Reporting/export as downloadable or shareable artifacts (CSV, PDF, a report snapshot beyond the live link) — the Query Assistant answers ad-hoc questions in-conversation (§4.7) but does not produce exportable report documents; that remains deferred.
- Query Assistant access from the read-only Team View (FR-24) — chat is PM-session-only (FR-28); team members do not get it in v1.
- Automatic carry-over of unfinished Backlog Issues into the next Sprint — always a manual re-pull (see FR-17).
- Notifications/reminders.

## 7. Success Metrics

**Primary**
- **SM-1**: Number of Sprints created and closed in-app, tracked sprint over sprint starting the first full sprint after launch — a running usage count, not a claim the app fully replaces any parallel spreadsheet (which the app can't observe). Validates FR-20–FR-23.
- **SM-2**: Sprints close with Actual Velocity within a reasonable range of Planned Velocity. `[NOTE FOR PM]` No target set at launch — deliberately deferred until a few real sprints establish a baseline; revisit this metric after that. Validates FR-14, FR-15.

**Counter-metrics (do not optimize)**
- **SM-C1**: Planned Velocity should not creep toward 100% of computed Capacity purely to make SM-2 look good — a deliberate buffer below full Capacity is healthy, not a miss. Counterbalances SM-2.

## 8. Open Questions

1. `[NOTE FOR PM]` The threshold for SM-2 ("close enough" between Planned and Actual Velocity) is intentionally unset — decide once a few sprints of real data exist. Owner: PM, revisit after the first few closed Sprints.
2. `[NOTE FOR PM]` FR-14's Actual Velocity depends on the team logging time against issues in YouTrack — confirm this is a practice your team already has or is willing to adopt before build starts, since without it Actual Velocity (and SM-2) will have no real data. Owner: PM, revisit before or during architecture.
3. Before architecture commits to this app owning all Sprint/board state (§4.4, §4.5), someone should connect to a live YouTrack MCP server and confirm it truly has no sprint/agile-board tool — see `[UNVERIFIED — docs only]` tag under FR-17. Owner: architecture phase.
4. FR-26's read-only enforcement assumes the YouTrack MCP server's tool list cleanly separates read/query tools from write tools so only the former can be registered with the assistant — this should be confirmed against a live server's actual tool list (same verification as Open Question 3) before architecture commits to that boundary. Owner: architecture phase.

## 9. Assumptions Index

- §4.4 FR-17 — YouTrack integration is read-only in v1; no writes back to YouTrack.
- §4.4 FR-17 — No native sprint/agile-board object on the YouTrack MCP surface is `[UNVERIFIED — docs only]`; see Open Question 3.
- §4.4 FR-18 — Issue estimate hours come from one configurable YouTrack custom field, with manual fallback if absent (v1 is single-Project, per FR-16).
- §4.6 FR-24 — "No authentication" for the PM's own session assumes the app is deployed on a network the team already trusts, not the open internet; the share link's unguessable token is defense-in-depth, not a replacement for that assumption.
- §4.7 FR-25/FR-26 — connection-failure handling for the Query Assistant mirrors FR-16's inline-error pattern; see Open Question 4 for the read/write tool-separation assumption.
