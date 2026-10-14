---
title: 'Assistant suggests backlog issues that fit the Sprint''s remaining capacity'
type: 'feature'
created: '2026-10-14'
status: 'done'
baseline_commit: '4dac2ff7e619b4b7cebd30ddbb1d816b042765c1'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Filling a Sprint means juggling remaining capacity against backlog estimates by hand. The Assistant can list the backlog and report capacity, but it can't propose a set that fits, and asking the model to add up hours is unreliable.

**Approach:** Add a `suggest_sprint_fit` agent tool. A pure domain function selects pullable, estimated backlog issues whose estimates fit within the target share of the active Sprint's remaining capacity. Those issues are shown in the existing picker, pre-ticked; the PM still clicks Add to sprint.

## Boundaries & Constraints

**Always:**
- Remaining capacity = team `capacityHours` × target% − `sumEstimateHours(all pulled issues)`, i.e. `team.assignedHours` from `getSprintPlanData` (Dev-category capacity net of leave and holidays).
- The selection is computed in `domain/` (AD-1) and is deterministic for the same input.
- Only pullable leaf issues with an estimate > 0 are eligible (`filterBacklogIssues` + `hasPullableEstimate`).
- The picker shows only the chosen issues, pre-ticked; nothing is added without the PM's click.
- The result reports `budgetHours`, `selectedHours`, `leftoverHours` and the counts, rounded to 1 decimal, so the model only narrates.
- The tool description is ≤ 200 chars.

**Never:**
- No writes; never call `add_issues_to_sprint` from this tool.
- No per-row preselect or picker UI changes.
- No new dependencies and no DB migration.
- Never let the model pick or sum the issues itself.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fits | capacity 100h, pulled 60h, target 100, backlog has estimated issues | Chosen issues total ≤ 40h, picker pre-ticked, totals reported | N/A |
| Target % | target 85, capacity 100, pulled 60 | Budget 25h | N/A |
| Type preference | `prioritizeTypes:["Bug"]` | Bugs are considered before any other type | N/A |
| No room | pulled ≥ capacity × target% | `ok:true`, `budgetHours ≤ 0`, nothing chosen, no picker | N/A |
| Nothing fits | budget > 0, but every estimate exceeds it | `selected` empty, smallest eligible estimate reported, no picker | N/A |
| No active sprint | none | `{activeSprint:null}` | N/A |
| No Dev category | `devCategoryExists:false` | `ok:false` plain error (capacity unknown) | plain error |
| Bad target | target ≤ 0 or > 100 | `ok:false` | plain error |

**Decisions:**
- Order: issues in `prioritizeTypes` first (in the order given), then YouTrack priority (Show-stopper > Critical > Major > Normal > Minor, unknown/null last), then largest estimate first, then id for determinism.
- Default target when none given: 100% of capacity.

</frozen-after-approval>

## Code Map

- `domain/youtrack.ts` -- `YouTrackIssueSummary` (:28, has `priority`, `type`, `estimateHours` in hours); `filterBacklogIssues` (:117); `hasPullableEstimate` (:113). The new pure `suggestSprintFit` lives here, with `domain/youtrack.selfcheck.ts`.
- `domain/backlog-issue.ts:122` `sumEstimateHours` -- the "already committed" figure (all pulled issues, assigned or not); `app/sprint-plan-data.ts:152` exposes it as `team.assignedHours`.
- `app/api/assistant/agent-tool-logic.ts` -- `AGENT_TOOLS` (:40); `runAgentToolWith` (:318) has both `loadState()` (backlog, pulled ids) and `appData.capacity()`. `buildPickerSurface(id, rows, {preselect:true, hasActiveSprint})` (`picker-surface.ts:18`) works as-is when given only the chosen rows.
- `app/api/assistant/agent-tool-logic.selfcheck.ts` -- tool-name list assertion; fakes for `BacklogState` and `AppData`.
- `app/api/assistant/route.ts` `SYSTEM_PROMPT`; `app/(pm)/assistant/assistant-capabilities.tsx` "Sprint backlog" examples.

## Tasks & Acceptance

**Execution:**
- [x] `domain/youtrack.ts` + `domain/youtrack.selfcheck.ts` -- `suggestSprintFit(issues, budgetHours, {prioritizeTypes?})` → `{selected, selectedHours, leftoverHours, smallestEligibleHours}`: greedy pass in the agreed order, skipping issues that no longer fit -- pure and deterministic.
- [x] `app/api/assistant/agent-tool-logic.ts` -- `suggest_sprint_fit` schema (`targetPercent?`, `prioritizeTypes?`); computes the budget from `appData.capacity()`, picks from `pullable`, returns the totals plus `selected` ids, and a pre-ticked picker of the chosen issues -- reuses existing state and the picker.
- [x] `app/api/assistant/agent-tool-logic.selfcheck.ts` -- every I/O matrix row with fakes; updated name list.
- [x] `app/api/assistant/route.ts` -- prompt: use `suggest_sprint_fit` for "what fits / fill the sprint" requests, pass the PM's target % and preferred types, report the totals as returned, and remind the PM to click Add.
- [x] `app/(pm)/assistant/assistant-capabilities.tsx` -- add the example "Fill the sprint to 85%, bugs first".

**Acceptance Criteria:**
- Given an active Sprint with spare capacity, when the PM asks "what fits in the remaining capacity?", then the picker shows pre-ticked issues whose total ≤ the remaining hours, and nothing is added until the PM clicks Add.
- Given the same backlog and capacity, when asked twice, then the same issues are suggested.

## Implementation Notes

- Beyond the task list: `composeTools` skips the fallback table for `suggest_sprint_fit` when no rows (no-room / nothing-fits would otherwise render a misleading "1 result"). Greedy, not optimal knapsack. Model gets ≤ 50 ids, picker ≤ 150 (`selectedCount` is the real count).

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Evidence / route |
|---|---|---|---|
| 1 | smallestEligibleHours set when budget ≤ 0 → model says "too big" instead of "no room" (edge) | medium | spread only checks `selected.length === 0`. patch |
| 2 | Negative leftoverHours unexplained; figures rounded independently don't add up (blind) | low | `leftover = budget - 0` when no room; separate `hours()` calls. Direct correction. patch |
| 3 | Fit over truncated YouTrack listing reported as complete (edge) | medium | `state.truncated` not passed through. patch |
| 4 | targetPercent: 0.85 accepted, "85" rejected, validated and defaulted in two places (edge, blind) | medium | check is `>0 && <=100`; schema says 1-100. patch |
| 5 | prioritizeTypes as a plain string silently dropped (edge, blind) | medium | non-array → `[]`, so "bugs first" ignored. patch |
| 6 | capacity() throw path untested (gap) | medium | fixtures never reject. patch |
| 7 | Show-stopper rank untested (gap) | low | only Critical..Minor in fixtures. One assertion. patch |
| 8 | Two active-sprint sources (plan vs state) can disagree (blind) | false | both come from `sprintRepository.findActive()` (app DB); `loadBacklogState` reads the same row. rejected |
| 9 | Picker cap 150 vs counts from full selection (blind, edge) | low | needs >150 estimated issues fitting; unlikely; fix reshapes domain call. rejected |
| 10 | Model id list capped at 50 without a marker; untested (blind, edge, gap) | low | needs >50 picks; `selectedCount` gives real count. deferred |
| 11 | Custom priority schemes rank as "none" (blind) | low | the recorded decision fixes the default YouTrack set. rejected |
| 12 | capacity / backlog reads not one snapshot (blind, edge) | low | requires a concurrent pull within the same request; no named harm beyond a one-off suggestion. rejected |
| 13 | `composeTools` special-case `|| name === ...` (blind) | low | design nit, no named harm. rejected |
| 14 | Zero capacity reported as "no room" (blind) | low | `capacityHours: 0` is in the result for the model to state. rejected |
| 15 | >100% targets blocked, not stated in prompt (blind) | low | error text explains; spec decision. rejected |
| 16 | `selected` returns ids only, model can't explain picks (blind) | low | picker shows type/estimate; extra rows cost tokens. rejected |

## Verification

**Commands:**
- `npx tsc --noEmit -p .` -- expected: no errors
- `node domain/youtrack.selfcheck.ts` and `node app/api/assistant/agent-tool-logic.selfcheck.ts` -- expected: all assertions pass
- `npm run lint` -- expected: no new errors
