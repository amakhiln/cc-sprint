---
id: SPEC-sprint-velocity-planner
companions:
  - ../../planning-artifacts/prds/prd-pm-2026-08-12/prd.md
  - ../../planning-artifacts/architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md
sources:
  - ../../planning-artifacts/prds/prd-pm-2026-08-12/addendum.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. The PRD companion carries FR-level detail (testable consequences, worked examples, user journeys); the Architecture Spine companion carries the paradigm, Architecture Decisions, and stack this must be built with. Consult `sources:` only for narrative rationale this contract intentionally omits.

# Sprint & Velocity Planner

## Why

A pain to solve: sprint capacity is guessed, not calculated. A PM eyeballs who's available, how much of their time is actually dev work versus meetings and planning, and who's on leave, then hopes the sprint plan holds. This tool makes that math explicit — allocation percentages, leave/holiday deductions, and real backlog work from YouTrack combine into a real capacity number the PM can plan a two-week sprint against, with velocity trend feedback improving that estimate over time.

## Capabilities

- **CAP-1 — Team Roster & Allocation**
  - **intent:** PM maintains a team roster and splits each member's time across a shared, PM-configurable set of allocation categories (e.g. Dev, Management, DevOps) as percentages.
  - **success:** Adding, removing (soft-delete — history preserved), or re-allocating a Team Member is reflected in Capacity for the current and future Sprints without altering any closed Sprint's recorded history.

- **CAP-2 — Leave & Holidays**
  - **intent:** PM records Planned Leave, Emergency Leave, and company-wide Holidays; Leave reduces one Team Member's Capacity, Holidays reduce everyone's.
  - **success:** Given a Holiday that falls inside a Leave range, or a Leave range spanning a weekend, Capacity reflects exactly the distinct working days lost — never double-counted, never counting a non-working day. Emergency entries recalculate Capacity immediately.

- **CAP-3 — Capacity & Velocity Calculation**
  - **intent:** System computes each Team Member's and the team's total Capacity in hours per Sprint, and tracks Planned Velocity against a PM-confirmed Actual Velocity (sourced from YouTrack logged time) across Sprints as a trend.
  - **success:** A closed Sprint's Capacity, Allocation breakdown, and confirmed Actual Velocity remain unchanged in Velocity History regardless of later roster changes. An active Sprint's numbers stay live against current roster/leave state.

- **CAP-4 — YouTrack Integration (via MCP)**
  - **intent:** PM connects to one YouTrack project through its MCP server, browses and pulls Backlog Issues into a Sprint read-only, and pulls logged hours at Sprint close.
  - **success:** Viewing an already-planned Sprint never fails because YouTrack is unreachable. An invalid connection surfaces a clear inline error at configuration time, not silently.

- **CAP-5 — Sprint Planning**
  - **intent:** PM creates, plans (assigns issues to Team Members, sees an advisory over-allocation warning), and closes a two-week (configurable) Sprint, with exactly one Sprint open at a time.
  - **success:** One screen shows roster, Capacity/Allocation breakdown, Leave/Holidays, assigned issues, and planned-vs-available Capacity together. Creating a second Sprint while one is open is rejected.

- **CAP-6 — Read-Only Team View**
  - **intent:** Any team member views the current Sprint's plan via an unguessable shared link, with no login and no ability to edit.
  - **success:** The share route cannot execute a write action even if one is attempted, and stays viewable independent of the PM's own session.

## Constraints

- No authentication/login system in v1, for the PM or the team — access is gated only by network trust (PM's editing surface) and an unguessable link token (CAP-6).
- Single YouTrack Project connection in v1, not multiple.
- Exactly one Sprint may be open at a time.
- v0 hosting runs the app on the PM's own machine; CAP-6 is not reachable independent of that machine being on and networked until hosting is revisited — a known, accepted v0 limitation, not a defect.
- CAP-3's Actual Velocity sources YouTrack logged time-tracking hours, a practice the team does not yet have — a new operational dependency the system depends on rather than something it can route around.

## Non-goals

- Not a YouTrack replacement — issue authoring, comments, and workflow stay in YouTrack; this system only reads Backlog Issues.
- Not multi-team or multi-PM — one team, one PM, one roster.
- Not a system of record for HR/payroll leave balances.
- No team-member accounts, login, or self-service (leave submission, assignment acceptance).
- No mobile app, no notifications, no reporting/export, no automatic carry-over of unfinished issues between Sprints.

## Success signal

The PM plans and closes real two-week Sprints in this tool instead of a spreadsheet, sprint over sprint, trusting the Capacity number enough to commit without re-checking the math by hand — and Velocity History accumulates real Planned-vs-Actual data that sharpens future sprint commitments.

## Assumptions

- YouTrack integration is read-only in v1; no writes back to YouTrack (CAP-4).
- Issue estimate hours come from one configurable YouTrack custom field, with manual entry as fallback if absent (CAP-4).
- The no-auth PM session assumes a trusted deployment; in v0 that concretely means a single laptop, not yet a general "trusted network" (see Constraints).

## Open Questions

- Is the team's willingness/ability to log time in YouTrack (required for CAP-3's Actual Velocity) confirmed, or does it need validating before build?
- What threshold defines "close enough" between Planned and Actual Velocity? Deliberately deferred until a few Sprints of baseline data exist.
- When should always-on hosting be revisited so CAP-6 is reachable by the team, not just the PM?
