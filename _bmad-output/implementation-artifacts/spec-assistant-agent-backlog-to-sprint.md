---
title: 'Assistant Agent: Filter Backlog and Add Picks to the Current Sprint'
type: 'feature'
created: '2026-10-06'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '79112e8ceb3f936ddb1092523465e9bfde38fb7a'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The assistant can only answer read-only YouTrack questions. The PM can't ask it something like "show sub-tasks without estimates" or "add the estimated sub-tasks to the sprint". Today that means filtering by hand in the Backlog drawer.

**Approach:** Turn the assistant into an agent with two app-local tools:
- `list_backlog_issues` filters the open backlog by any Type, by estimate status, and by text.
- `show_issue_picker` renders an interactive A2UI checklist (via `@a2ui/react`) of the issues the agent chose.

When the PM ticks rows and clicks **Add to sprint**, the app pulls those issues into the active Sprint. The model never writes anything itself.

## Boundaries & Constraints

**Always:**
- Type filtering is generic: any YouTrack Type value (case-insensitive), not hard-coded to "Sub-task". Estimate filter is `with | without | any`.
- The listing only covers pullable issues, using the same rule as the Backlog drawer: an unresolved leaf (no `rollups` entry) that isn't already in the active Sprint. A parent issue is never offered.
- The model only chooses issue **ids**. App code builds every picker row (id, summary, type, estimate) from the real `listOpenIssues` result. An id that isn't in the listing is dropped, never rendered.
- Issues without an estimate appear in the picker as a separate "needs an estimate" text list, never as a checkbox (`pullBacklogIssue` rejects estimate ≤ 0; A2UI CheckBox has no disabled state).
- The add action is a Server Action that takes only YouTrack ids. It re-fetches the issues server-side, re-applies the pullable rule, and calls `pullBacklogIssue` for each issue. It never trusts a title or estimate sent by the client.
- Add results are reported per issue (added / already in sprint / failed) inside the picker.
- MCP tools stay read-only (`READ_ONLY_TOOL_NAMES` unchanged). The new tools are added beside them in `route.ts` and dispatched before `callAllowedTool`.

**Ask First:** adding any tool that lets the model itself write (pull, assign, edit YouTrack).

**Never:**
- Never write to YouTrack. "Add to sprint" means this app's active Sprint: a local `BacklogIssue` row via `pullBacklogIssue`. YouTrack is only read.
- Never let the model call a write directly. Adding happens only on the PM's button click.
- Never persist chat or picker state server-side.
- Never reachable from `app/share/[token]/`.
- Never auto-assign in this story. That's the drawer's best-effort name-match, deferred here.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| FILTER | "Sub-tasks without estimates" | `list_backlog_issues({type:"Sub-task", estimate:"without"})` → model reports count, then shows picker | N/A |
| PROPOSE_ADD | "Add the estimated sub-tasks to the sprint" | Picker with estimated rows pre-ticked and an Add button | N/A |
| CONFIRM_ADD | PM clicks Add with 3 ticked | 3 pulled; picker shows a result per row; Sprint pages revalidated | Per-row failure is shown, the others still succeed |
| NO_ACTIVE_SPRINT | No active Sprint | Picker is rendered but Add is disabled, with the note "No active Sprint" | Server Action also returns an error |
| HALLUCINATED_ID | Model passes an id that isn't in the backlog | Row dropped. If none remain, the tool returns an error result | N/A |
| YOUTRACK_DOWN | `listOpenIssues` fails | Tool returns `{ok:false}` → `{type:"error"}` chunk | No silent empty list |
| NOT_CONFIGURED | REST YouTrack env missing | Tool error with `NOT_CONFIGURED_MESSAGE` | Same |

</frozen-after-approval>

## Code Map

- `infrastructure/youtrack/issues.ts:216` `listOpenIssues` -- source of issues + `rollups` (leaf = no key). Unresolved only, capped at 500 (`truncated`).
- `domain/youtrack.ts:76` `listBacklogIssues(configRepo, port)` -- reuse; add pure `filterBacklogIssues(issues, rollups, pulledIds, {type?, estimate?, search?})` here.
- `domain/backlog-issue.ts:63` `pullBacklogIssue` -- the only write path; validates the active Sprint and estimate, handles P2002 as already pulled.
- `app/actions/backlog-issues.ts:13` -- pattern for a Server Action (input guard, try/catch, `revalidatePath` of `/sprint`, `/roster`, `/`).
- `app/(pm)/sprint/backlog-drawer.tsx:558` -- the pullable rule the agent must mirror (`!pulled && rollups[id]===undefined`, estimate > 0).
- `infrastructure/db/backlog-issue-repository.ts` `listForSprint`, `infrastructure/db/sprint-repository.ts` `findActive` -- already-pulled ids + active Sprint.
- `app/api/assistant/route.ts:96-121` -- tool list + `executeTool` wiring; prepend local tools and dispatch by name. `SYSTEM_PROMPT` gains agent rules.
- `infrastructure/query-assistant/client.ts:23` `AssistantChunk` -- add `{type:"ui"; surface: unknown}`. The loop currently emits `source` per tool; a tool result with a `ui` field also emits a `ui` chunk. The model sees only a short ack, never the A2UI JSON.
- `app/(pm)/assistant/assistant-chat.tsx:240` `applyChunk`/`isAssistantChunk` -- accept `ui` chunks; store them on the message and render `<IssuePicker>`.
- `@a2ui/react@0.12.0` (verified in scratchpad) -- use the **v0.9** API, not the package root, which is legacy v0.8:
  - Imports: `import {A2uiSurface, basicCatalog} from '@a2ui/react/v0_9'` and `import {MessageProcessor} from '@a2ui/web_core/v0_9'`.
  - Render: `new MessageProcessor([basicCatalog], onAction)`, then `.processMessages(msgs)`, then `<A2uiSurface surface={p.getSurface(id)}/>`.
  - Messages: `{version:"v0.9", createSurface|updateComponents|updateDataModel}`. The catalog id is `basicCatalog.id`. Rows come from a `List` with template `children:{path:"/issues",componentId:"row"}`; each row is a `CheckBox` with `label:{path:"label"}` and `value:{path:"selected"}`. The `Button` needs `child` (a Text id) and `action:{event:{name:"add_to_sprint",context:{issues:{path:"/issues"}}}}`, and `onAction` receives `context.issues` already resolved.
  - Gotchas:
    - It isn't SSR-safe (`useSyncExternalStore` has no server snapshot). Load it with `next/dynamic(..., {ssr:false})`.
    - `A2uiSurface` takes no `className`, so wrap it and theme it with the `--a2ui-*` CSS vars.
    - Use h-variant/caption `Text` only. A body variant needs a markdown provider.
    - `CheckBox` has no disabled state. Rows without an estimate are rendered as a separate `Text` list ("needs an estimate"), not as checkboxes.
  - Peer dependency: `zod ^3.25.76`.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `@a2ui/react@0.12.0` (+ `zod` peer if missing)
- [x] `domain/youtrack.ts` -- `filterBacklogIssues` + `BacklogFilter` type -- pure, testable
- [x] `domain/youtrack.selfcheck.ts` -- cases: type match is case-insensitive, parents excluded, already-pulled excluded, with/without estimate (null and 0 both count as "without"), search on id/summary
- [x] `app/api/assistant/agent-tools.ts` (new) -- `AGENT_TOOLS: AssistantTool[]` + `runAgentTool(name, args)` returning `{ok,result}`. The picker builds the A2UI surface from real issue data; returns ≤150 compact rows + `total` to the model
- [x] `infrastructure/query-assistant/client.ts` -- `ui` chunk passthrough; keep the A2UI payload out of the model's context
- [x] `app/api/assistant/route.ts` -- register agent tools ahead of MCP tools; dispatch; update system prompt
- [x] `app/actions/assistant-sprint.ts` (new) -- `addIssuesToActiveSprintAction(ids: string[])` → per-id results
- [x] `app/(pm)/assistant/issue-picker.tsx` (new, client, loaded via `next/dynamic` ssr:false) -- renders the A2UI surface; on `add_to_sprint` calls the action with ticked keys, then shows per-row results below the surface (React, not A2UI)
- [x] `app/(pm)/assistant/assistant-chat.tsx`, `assistant-capabilities.tsx` -- `ui` chunk handling + an example prompt

**Acceptance Criteria:**
- Given an open backlog with mixed types, when I ask for "<Type> without estimates", then only unresolved, unpulled leaf issues of that type with no estimate are listed
- Given a picker with ticked rows, when I click Add to sprint, then exactly those issues appear on `/sprint` and each row shows its outcome
- Given any picker, then rows without an estimate can't be ticked

## Spec Change Log

## Design Notes

Why the model only picks ids: the same grounding stance as Story 5.2. App code renders every figure, so a hallucinated title or estimate can't reach the UI or the DB. A2UI renders on the client only. The server builds the message array, and the client feeds it to the renderer.

## Verification

**Commands:**
- `node domain/youtrack.selfcheck.ts` -- all pass
- `node infrastructure/query-assistant/client.selfcheck.ts` -- all pass (plus the `ui` passthrough case)
- `npx tsc --noEmit` -- clean; `npm run lint` -- no new errors

**Manual checks:**
- Run the app against the `pm_test` schema with synthetic data, never the PM's real records. On `/assistant`, ask "sub-tasks without estimates", then "add estimated Tasks to the sprint". Tick 2 rows, click Add, and confirm they appear on `/sprint`.

## Suggested Review Order

**Agent tools — the model only picks ids**

- Entry point: both tools, rows always built from fetched data, never from model args.
  [`agent-tool-logic.ts:73`](../../app/api/assistant/agent-tool-logic.ts#L73)

- Pullable rule shared by listing and adding: unresolved leaf, not already pulled.
  [`youtrack.ts:117`](../../domain/youtrack.ts#L117)

- Route composition: agent tools dispatched locally, MCP stays allowlisted, name clashes dropped.
  [`agent-tool-logic.ts:202`](../../app/api/assistant/agent-tool-logic.ts#L202)

- Wiring plus one backlog fetch per turn, shared by list then picker.
  [`route.ts:115`](../../app/api/assistant/route.ts#L115)
  [`agent-tools.ts:33`](../../app/api/assistant/agent-tools.ts#L33)

- System prompt: never claim issues were added; only the PM's click adds.
  [`route.ts:29`](../../app/api/assistant/route.ts#L29)

**The only write path — PM's click**

- Re-fetches server-side, re-applies the rule, per-row results; one throw can't hide earlier adds.
  [`agent-tool-logic.ts:147`](../../app/api/assistant/agent-tool-logic.ts#L147)

- Thin Server Action binding plus revalidation.
  [`assistant-sprint.ts:11`](../../app/actions/assistant-sprint.ts#L11)

**A2UI picker**

- Pure A2UI v0.9 builder; unestimated issues are text, never checkboxes.
  [`picker-surface.ts:20`](../../app/api/assistant/picker-surface.ts#L20)

- Only ticked, well-formed rows can reach the Add action.
  [`picker-surface.ts:86`](../../app/api/assistant/picker-surface.ts#L86)

- Client renderer: per-surface lock against double-submit, inline errors, live status.
  [`issue-picker.tsx:43`](../../app/(pm)/assistant/issue-picker.tsx#L43)

- UI travels beside the tool result, so it never enters model context.
  [`client.ts:149`](../../infrastructure/query-assistant/client.ts#L149)

- Client-only load, since @a2ui/react isn't SSR-safe.
  [`assistant-chat.tsx:14`](../../app/(pm)/assistant/assistant-chat.tsx#L14)

**Tests**

- Filter, made-up ids, caps, routing, per-row add results, no active Sprint.
  [`agent-tool-logic.selfcheck.ts:1`](../../app/api/assistant/agent-tool-logic.selfcheck.ts#L1)

- The real MessageProcessor accepts the surface; ticked-ids helper.
  [`picker-surface.selfcheck.ts:1`](../../app/api/assistant/picker-surface.selfcheck.ts#L1)

- Chat accepts `ui` chunks; drops malformed ones.
  [`chunk.selfcheck.ts:1`](../../app/(pm)/assistant/chunk.selfcheck.ts#L1)
