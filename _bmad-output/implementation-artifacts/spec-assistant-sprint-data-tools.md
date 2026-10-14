---
title: 'Assistant sees the app''s sprint data (capacity, progress, velocity, leave)'
type: 'feature'
created: '2026-10-14'
status: 'done'
baseline_commit: 'bb6909edf91adaa1156f24229cfb81e3813ccc6e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Assistant can only see YouTrack and the pullable backlog, so it can't help with sprint goal, allocation, refinement, demo or retro questions, all of which need this app's own capacity, progress, velocity and leave figures. Its capabilities panel even says it "Doesn't see this app's Capacity, Leave, or Progress figures."

**Approach:** Add four read-only app-local agent tools (`get_sprint_capacity`, `get_sprint_progress`, `get_velocity_history`, `get_leave`). Each returns a compact, **precomputed** summary built from the existing loaders and domain code, so the model only narrates figures and never does arithmetic. Update the system prompt and the capabilities panel to match.

## Boundaries & Constraints

**Always:**
- Every figure comes from `domain/` via the existing loaders (AD-1).
- Closed sprints are read from the `snapshot*` fields and never recomputed (AD-2).
- Tools are read-only. Failures return `{ok:false, error}` in plain words (AD-8).
- Hours are rounded to 1 decimal.
- Tool descriptions are ≤ 200 chars each and results contain no unused fields, to stay inside Groq's free-tier limit of about 8K input tokens a minute.
- The row list a PM should see is the **first** array in each result, because `buildResultSurface` renders the first array.

**Never:**
- No writes of any kind.
- No new YouTrack MCP tools.
- Never import anything assistant-related into `app/sprint-plan-data.ts` or `app/share/[token]/` (AD-4).
- Never send the full burndown series to the model.
- No new dependencies and no DB migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Capacity, active sprint | `get_sprint_capacity` | Team `capacityHours`, `fullDevHours`, `assignedHours`, `overAllocated`, category breakdown; `members[]` rows with the same per-member fields plus `daysOff` | N/A |
| No active sprint | any of capacity / progress / leave-without-range | `{ok:true, result:{activeSprint:null}}`; the model says there is no active sprint | N/A |
| Progress | `get_sprint_progress` | Totals (estimate, logged, remaining, overrun count), `issues[]` rows, `burndown:{date, idealHours, remainingHours, behindByHours}` taken from the latest non-null point | YouTrack worklog failure → `{ok:false}` plain error |
| Velocity | `get_velocity_history` | `sprints[]` rows (name, dates, snapshot capacity, planned, actual, delta), plus `averageDelta` and `count` | Zero closed sprints → `count:0`, empty list |
| Leave, range | `get_leave {from,to}` ISO dates | Leaves overlapping the range (member, type, dates) plus holidays overlapping it | Invalid or reversed dates → `{ok:false}` |
| Leave, no range | `get_leave {}` | Same, scoped to the active sprint | No active sprint → `activeSprint:null` |

</frozen-after-approval>

## Code Map

- `app/api/assistant/agent-tool-logic.ts` -- `AGENT_TOOLS` (:34), `runAgentToolWith` (:92). Dispatch the new names **before** `loadState()` (next to `add_issues_to_sprint`), or they fall through to the picker branch at :145. Add an optional injected `appData` parameter. `composeTools` (:246) already adds a result table to any `ok` result without `ui`.
- `app/api/assistant/agent-tools.ts` -- `createAgentToolExecutor()` binds the real loaders into `appData`.
- `app/api/assistant/agent-tool-logic.selfcheck.ts` -- fakes; the exact tool-name assertion at :78 must list the new tools.
- `app/sprint-plan-data.ts:110` `getSprintPlanData()` -- reuse for capacity. Members already carry `sprintEntries` (leave and holidays). Shared with the share page; import from it, never into it.
- `app/progress-data.ts:46` `getProgressData()` -- reuse for progress. Makes a live YouTrack worklog call.
- `app/(pm)/velocity-history/page.tsx:23-45` -- inline velocity rows and `averageDelta`. Extract them into a loader.
- `app/(pm)/leave/page.tsx:46-57` -- inline leave/holiday query. The tool reuses the same repositories plus `rangesOverlap` (`domain/calendar.ts:8`).
- `domain/progress.ts` -- `BurndownPoint` (:72). Add the pure `summarizeBurndown`.
- `app/api/assistant/route.ts:35` `SYSTEM_PROMPT`; `app/(pm)/assistant/assistant-capabilities.tsx` `CAPABILITIES` (:7) and `LIMITS` (:49).

## Tasks & Acceptance

**Execution:**
- [x] `app/velocity-history-data.ts` -- new `getVelocityHistoryData()` holding the page's row and `averageDelta` logic, plus `snapshotCapacityHours`; `app/(pm)/velocity-history/page.tsx` uses it -- one source for the page and the tool.
- [x] `domain/progress.ts` + `domain/progress.selfcheck.ts` -- `summarizeBurndown(points)`: the latest point with non-null remaining, returned as `{date, idealHours, remainingHours, behindByHours}` (null if none) -- keeps the arithmetic out of the model and in `domain/`.
- [x] `app/api/assistant/agent-tool-logic.ts` -- 4 tool schemas; `AppData` type `{capacity, progress, velocity, leave(range)}` injected as the 3rd arg of `runAgentToolWith`; per-tool compact result mappers, ISO dates, 1-decimal hours, and arg validation for `get_leave` -- the pure core stays testable with fakes.
- [x] `app/api/assistant/agent-tools.ts` -- bind `getSprintPlanData`, `getProgressData`, `getVelocityHistoryData` and a leave loader (repositories + `rangesOverlap`, defaulting to the active sprint).
- [x] `app/api/assistant/agent-tool-logic.selfcheck.ts` -- cover every I/O matrix row with fakes and update the name list.
- [x] `app/api/assistant/route.ts` -- system prompt: use the 4 app tools (not YouTrack) for capacity, progress, velocity and leave; quote figures as returned and attribute them to "this app"; say plainly when there is no active sprint.
- [x] `app/(pm)/assistant/assistant-capabilities.tsx` -- add a "Sprint capacity & progress" group with examples, and remove the "Doesn't see Capacity, Leave, or Progress" limit.

**Acceptance Criteria:**
- Given an active sprint, when the PM asks "Do we have room for more work?", then the assistant calls `get_sprint_capacity` and reports remaining or over-allocated hours exactly as the tool returned them.
- Given any new tool result, when it renders, then the PM sees a table of its first array under the answer.
- Given the velocity page, when loaded after the refactor, then it shows the same numbers as before.

## Implementation Notes

- Beyond the task list: `result-surface.ts` `buildResultSurface` returns null when no columns exist (so `{activeSprint:null}` renders no empty table); capacity `team.remainingCapacityHours` precomputed (capacity - assigned); system message now carries today's UTC date/weekday so `get_leave` can resolve "next week"; velocity sends at most 12 most-recent sprints (`count`/`averageDeltaHours` cover all).
- Table caps at 6 columns: capacity rows drop `categoryHours`, progress rows drop `overrunHours` in the UI (model still gets them).

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Evidence / route |
|---|---|---|---|
| 1 | Empty row array → wrapper rendered as "1 result" table (edge, blind-other, gap-other) | medium | `extractSourceRows` single-record fallback (result-surface.ts:117-125) fires when no non-empty row array. patch |
| 2 | get_leave holidays hidden when leaves exist / unlabelled when not; holidays uncapped (edge, blind) | medium | `findRowArray` returns first non-empty array only; `holidays` not sliced. patch (single `entries` array) |
| 3 | Truncation invisible: no `total`, countLabel reads only `meta.total` (blind, edge) | medium | result-surface `countLabel` uses `meta.total`; results use `count`/`totals.issueCount`. patch |
| 4 | overAllocated `?? false` when comparison never computed (edge, blind) | medium | sprint-plan-data leaves it undefined with assignedHours; model would claim "not over-allocated". patch |
| 5 | remainingCapacityHours from unrounded values doesn't reconcile (edge, blind) | low | selfcheck fixture: 100, 110.3 → -10.2. Direct correction. patch |
| 6 | Per-member progress not sent → model must add up issues (blind) | medium | `ProgressData.members` computed but unmapped; contradicts "model never does arithmetic". patch |
| 7 | burndown null unexplained; relative leave dates not echoed; partial lists (blind) | low | prompt has no null/partial guidance. One-line prompt additions. patch |
| 8 | Capabilities panel states no limits for new tools (blind) | low | LIMITS line removed, none added. patch |
| 9 | Render selfcheck only asserts `out.ui` exists (gap) | medium | wrapper fallback also yields truthy ui. patch |
| 10 | "Today" computed in UTC; IST users before 05:30 get yesterday (edge, blind) | low | real but only for relative-date leave questions after local midnight; fix needs client-supplied date or team-timezone config (new surface). rejected |
| 11 | Burndown before sprint start reports 0 behind (edge) | false | before start, start point has remaining = ideal; "0h behind" is accurate. rejected |
| 12 | Progress fails whole when YouTrack not configured; generic error on listWorkLogs throw (edge, blind) | false | matches frozen I/O matrix row ("worklog failure → ok:false"); generic wording is cosmetic. rejected |
| 13 | loadLeave composition untested / duplicates leave page query (gap, blind) | low | 5 lines over tested `rangesOverlap`; extracting a shared pure helper adds public surface. deferred |
| 14 | getVelocityHistoryData untested (gap) | maybe-false | moved verbatim from the page; needs DB or a pure split to test. deferred |
| 15 | Velocity N+1 queries per closed sprint (blind) | low | pre-existing in the page; moved, not introduced. deferred |
| 16 | Selfchecks not wired into scripts/CI (gap-other) | low | pre-existing project convention. rejected |

## Verification

**Commands:**
- `npx tsc --noEmit -p .` -- expected: no errors
- `node app/api/assistant/agent-tool-logic.selfcheck.ts` and `node domain/progress.selfcheck.ts` -- expected: all assertions pass
- `npm run lint` -- expected: no new errors

**Manual checks:**
- `/assistant`: ask "What's our capacity this sprint?", "Are we behind on the burndown?", "How has velocity trended?", "Who's on leave next week?" Each should call the matching tool and show a table.
