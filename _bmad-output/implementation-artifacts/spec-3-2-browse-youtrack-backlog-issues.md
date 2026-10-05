---
title: 'Browse YouTrack Backlog Issues'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 3.1 lets the PM connect to YouTrack, but nothing yet reads any real backlog data from it — there's no way to see what work exists before deciding what to pull into a Sprint.

**Approach:** Add a `domain/youtrack.ts` `listBacklogIssues` function and a real `infrastructure/youtrack/issues.ts` adapter that calls YouTrack's actual, documented MCP tools (`search_issues`, `get_issue` — confirmed via JetBrains' own docs at the URL the human provided, not guessed). Reveal the result in a new read-only Backlog Drawer (a `Sheet` slide-over, newly installed via shadcn to match this app's existing glass design system) triggered from the Sprint page — the closest existing analog to "Sprint Plan," since that page doesn't exist yet (Epic 4). **Known constraint, carried over from Story 3.1 and deepened here:** JetBrains' docs describe tool *names* and rough *purpose* but not exact parameter/response JSON field names — the adapter is built against the best-documented shape available and defensive/tolerant parsing, not a confirmed exact schema; this remains unverifiable end-to-end without a real connected instance.

## Boundaries & Constraints

**Always:**
- `domain/youtrack.ts` (extend): `BacklogIssue = {id, summary, assignee: string|null, priority: string|null, estimateHours: number|null}`; `YouTrackIssuesPort = {listOpenIssues(config): Promise<{ok:true,data:BacklogIssue[]}|{ok:false,error:string}>}` (an injected port, same AD-1 shape as `YouTrackConnectionTester`); `listBacklogIssues(configRepo, issuesPort)`: read the singleton config via `configRepo.get()` — if `null`, return `{ok:false, error:"YouTrack is not connected yet — configure a connection in Settings."}` without ever calling the port; otherwise delegate to `issuesPort.listOpenIssues(config)`.
- `infrastructure/youtrack/issues.ts` (new — same `infrastructure/youtrack/` adapter boundary as `client.ts`, AD-3): implement `YouTrackIssuesPort` using the real, already-installed `@modelcontextprotocol/client` SDK. Connect (mirrors `client.ts`'s connect pattern — duplicated, not shared, since the two call sites diverge immediately after: a `ping()` vs a `callTool()`). Call the real, documented `search_issues` tool with `{query: \`project: ${config.projectId} #Unresolved\`, limit: 50}` (YouTrack's own real query-language syntax for project-scoping + open/unresolved issues; `limit: 50` caps a first "browse" pass — no pagination UI this story). Parse the result per MCP's real `CallToolResult` envelope (confirmed by reading the installed SDK's schema): try `result.structuredContent` first if present, else `JSON.parse` the first `content` block with `type: "text"`; treat `result.isError` or a parse failure as a fetch error, not a silent empty list. For each matched issue, call the real, documented `get_issue` tool (`{issueId: id}`) to read `customFields` for assignee/priority/estimate — these aren't in `search_issues`'s documented response — tolerantly matching field names case-insensitively (`"assignee"`, `"priority"`, `"estimation"`/`"estimate"`); a missing/unmatched field yields `null`, never a thrown error for that one issue. Close the client in a `finally`, matching `client.ts`'s pattern exactly (including logging unexpected errors before returning a generic `{ok:false}`).
- `app/actions/youtrack.ts` (extend): `listBacklogIssuesAction(): Promise<ListOpenIssuesResult>` — no input, calls `listBacklogIssues` with the real config repo + real issues port, same try/catch/never-throw shape as `saveYouTrackConfigAction`.
- `components/ui/sheet.tsx` (already installed and glass-styled this pass) + `app/(pm)/sprint/backlog-drawer.tsx` (new): a `SheetTrigger` button ("Browse Backlog") on the Sprint page opening a right-side `SheetContent`. On open, calls `listBacklogIssuesAction()` (client-side, on-demand — not fetched at page load, since it's a real external round trip). States: loading (skeleton rows, per EXPERIENCE.md), not-configured (`{ok:false}` with the "not connected" message → a "Connect YouTrack" prompt linking to `/settings`, matching EXPERIENCE.md's exact state pattern), fetch error (any other `{ok:false}` → inline error, no crash), and the issue list itself (summary, assignee, priority, estimate hours — each blank/omitted gracefully when `null`, never a broken row).
- `app/(pm)/sprint/page.tsx`: render `<BacklogDrawer />`'s trigger regardless of active-Sprint state — Story 3.2's own AC only requires "a saved YouTrack connection," nothing about an active Sprint.

**Ask First:** _None known — the tool-contract uncertainty was already raised and the human pointed to real documentation, which was read and incorporated._

**Never:**
- No issue selection, staging, or pulling into a Sprint — Story 3.3's job. This drawer is view-only.
- No create/edit/comment/write-back affordance anywhere in the drawer — matches this story's own explicit read-only AC.
- No pagination UI — a flat 50-issue cap this pass, per Design Notes.
- No changes to `client.ts`'s connection-tester or its already-shipped behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| NOT_CONFIGURED | No `YouTrackConfig` row exists | The port is never called; a "not connected" message is returned | N/A |
| FETCH_FAILS | The port's `listOpenIssues` returns `{ok:false}` (network error, tool error, unparseable response) | The drawer shows an inline error, not a crash or a silently-empty list | The port's error message is shown |
| MISSING_OPTIONAL_FIELD | An issue has no assignee, priority, or estimate | That field renders blank for that row; the row itself still renders | N/A |
| EMPTY_BACKLOG | The project has zero open issues | The drawer shows an explicit "no open issues" message, not a blank area indistinguishable from a loading/error state | N/A |

</frozen-after-approval>

## Code Map

- `domain/youtrack.ts:37` `saveYouTrackConfig` — the existing validate/delegate shape; `listBacklogIssues` is a simpler sibling (no validation, just a configured-or-not branch).
- `infrastructure/youtrack/client.ts:11` `youTrackConnectionTester` — the connect/error-handling/logging/`finally`-close pattern `issues.ts` mirrors exactly.
- `app/actions/youtrack.ts:8` `saveYouTrackConfigAction` — the Server Action shape to mirror for `listBacklogIssuesAction`.
- `app/(pm)/sprint/page.tsx` — the existing Sprint page; add the drawer trigger here (closest analog to "Sprint Plan," Epic 4 doesn't exist yet — same interim-placement precedent as Stories 2.5/2.6's Roster placement).
- `app/(pm)/roster/leave-entry-form.tsx` — existing `Popover`-based on-demand-fetch-free precedent; `backlog-drawer.tsx` differs by needing an actual `useEffect`/on-open fetch, since its content is server data, not a static form.
- `node_modules/@modelcontextprotocol/core/dist/auth-BWdKR39I.d.mts` (`CallToolResultSchema`) — the real, confirmed `{content: [...], structuredContent?, isError?}` envelope every `callTool()` response follows.
- JetBrains' YouTrack MCP docs (URL provided by the human) — the real, documented tool names (`search_issues`, `get_issue`) and their described-in-prose (not schema-exact) purpose/fields.

## Tasks & Acceptance

**Execution:**
- [x] `domain/youtrack.ts` -- `BacklogIssue`, `YouTrackIssuesPort`, `listBacklogIssues`.
- [x] `domain/youtrack.selfcheck.ts` -- extend with NOT_CONFIGURED and FETCH_FAILS using a fake port (never the real SDK).
- [x] `infrastructure/youtrack/issues.ts` (new) -- `YouTrackIssuesPort` via the real SDK, tolerant parsing.
- [x] `app/actions/youtrack.ts` -- `listBacklogIssuesAction`.
- [x] `app/(pm)/sprint/backlog-drawer.tsx` (new) -- the Sheet-based drawer, all four states.
- [x] `app/(pm)/sprint/page.tsx` -- render the drawer's trigger.

**Acceptance Criteria:**
- Given a saved YouTrack connection, when I open the backlog browser, then I see the project's open issues with summary, assignee, priority, and estimate field where available.
- Given the backlog browser, when I view it, then there is no way to create, edit, comment on, or otherwise write back to a YouTrack issue from this screen.

## Design Notes

The `get_issue`-per-issue enrichment is an accepted N+1 pattern (one extra tool call per issue beyond the initial `search_issues`) — `search_issues`'s documented response doesn't include assignee/priority/custom fields, so there's no single-call alternative with the tools JetBrains actually documents. The `limit: 50` cap keeps this bounded for a first browsing pass; revisit with real pagination if a real backlog regularly exceeds it.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/youtrack.selfcheck.ts` -- expected: all assertions pass, including the new NOT_CONFIGURED/FETCH_FAILS cases, using a fake port.
- Real-DB check (kept pattern from prior stories): confirm `listBacklogIssues` returns the "not connected" message when no config row exists.
- `npm run dev` + manually: open the Backlog Drawer with no connection configured (expect the "Connect YouTrack" prompt); confirm the drawer has no create/edit/pull affordances anywhere.

**Manual checks (if no CLI):**
- **Explicitly cannot be verified this pass:** the adapter's parsing logic against a real `search_issues`/`get_issue` response shape, and therefore whether real assignee/priority/estimate values actually surface correctly. Flag this to the human and log it in `deferred-work.md`.

**Results (2026-08-19 pass):**

- The first implementation attempt hit a session usage limit before writing any Story-3.2-specific code (confirmed by inspecting disk state -- only Story 3.1's files existed). Implemented the full story directly.
- Also installed `components/ui/sheet.tsx` via the shadcn CLI (declining its offer to overwrite the already-customized `button.tsx`), and added `glass-strong` to `SheetContent` to match `dialog.tsx`'s existing glass treatment -- DESIGN.md applies the glass panel everywhere, and the freshly-generated Sheet didn't have it by default.
- `npx tsc --noEmit`, `npm run lint` -- both clean.
- `node domain/youtrack.selfcheck.ts` -- all assertions passed, including HAPPY_PATH, NOT_CONFIGURED, and FETCH_FAILS against a fake port.
- **Real-DB check:** confirmed `listBacklogIssues` against the real `youTrackConfigRepository` (no `@modelcontextprotocol/client` involved for this path) returns the exact "not connected" message end-to-end with no config row present.
- **Real-render check attempted, not achieved:** tried the `msedge.exe --headless=new --dump-dom` technique that worked for Story 2.4's simpler static Dialog case, temporarily forcing the drawer open plus a mount-time fetch trigger. Across several attempts (with and without `--virtual-time-budget`, up to 35s) the Sheet's portal content never appeared in the dumped DOM -- only the trigger button rendered. Root cause not conclusively identified (headless hydration timing vs. the async Server Action round-trip vs. some other headless-specific gap); not worth further time given diminishing returns. Reverted the temporary test edits. This is the same standing "no real browser walkthrough" gap already logged for Stories 1.6/1.7/2.1/2.2/2.3/3.1 -- Playwright MCP tooling remains unreachable.
- **Still explicitly unverified, as disclosed in the spec up front:** the adapter's parsing logic against a real YouTrack `search_issues`/`get_issue` response. Logged to `deferred-work.md`.

**Results (2026-08-19 review-patch pass):**

Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) ran against the diff. All three independently flagged the same top finding. Patched:

- `domain/youtrack.ts` / `app/(pm)/sprint/backlog-drawer.tsx` -- the drawer's "not configured" routing compared `result.error` against a locally-duplicated copy of the domain's exact message string; a future wording tweak to one without the other would silently misroute to the generic error banner. Exported `NOT_CONFIGURED_MESSAGE` as a shared constant from `domain/youtrack.ts`; the drawer now imports it instead of re-declaring the literal.
- `infrastructure/youtrack/issues.ts` -- added `infrastructure/youtrack/issues.selfcheck.ts` covering the previously-untested pure parsing helpers (`extractToolResultData`, `extractIssueList`, `findCustomField`, `extractFieldName`, `extractEstimateHours`) against fabricated fixtures -- distinct from "not tested against a real server," these were untested even against fakes. Also: `extractToolResultData` now tries every `text` content block (not just the first) and distinguishes "no usable data" (`isError`, unparseable, malformed shape) from a genuinely empty/null result via a `NO_DATA` sentinel, so a malformed `search_issues` response is now a fetch error rather than silently rendering as "0 open issues"; `extractIssueList`'s id extraction now correctly falls back to the internal `id` when `idReadable` is present-but-empty (not just null/undefined); `extractEstimateHours` now also parses a Period field's `{presentation: "1d 2h"}` string form (previously only `{minutes}`), and rounds its output; `search_issues`/`get_issue` calls now pass the same `timeout` `connect()` already had, so a hanging tool call can no longer block the request indefinitely; the result now carries a `truncated` flag (`rawIssues.length === SEARCH_LIMIT`) so the UI can say so instead of silently capping at 50.
- `app/(pm)/sprint/backlog-drawer.tsx` -- fixed the "only ever fetches once" bug (`state.status === "idle"` gated every subsequent open) -- now refetches on every open, so a transient error, a since-fixed connection, or backlog changes don't get stuck until a full page reload; added an unmount guard so a resolved fetch can't `setState` after the component is gone; the truncated flag now renders an inline note; the estimate display is now rounded (`.toFixed(1)`) instead of a raw float.
- `components/ui/sheet.tsx` -- added the `isolate` class `SheetOverlay` was missing (present on `DialogOverlay`, and the code comment already claimed parity); aligned the close button's offset (`top-2 right-2`) with `Dialog`'s, removing an unexplained inconsistency.
- `app/(pm)/settings/youtrack-connection-form.tsx` -- the "Project" field had no guidance on expected format, which is exactly what makes a project name containing spaces or YouTrack query-syntax characters (`:`, `#`, etc.) break the backlog search silently. Relabeled to "Project ID" with a caption clarifying it's YouTrack's short-name identifier, not the display name, plus a placeholder example.

Deferred (see `deferred-work.md`): multi-value/array assignee fields not handled; ambiguous same-name `customFields` matches (first match wins); whether `get_issue` expects `idReadable` or the internal `id` (genuinely unknowable without a live server); no concurrency cap on the per-issue enrichment `Promise.all` (not expected to matter at this app's scale, now bounded by a timeout instead).

Re-ran `npx tsc --noEmit`, `npm run lint`, `node domain/youtrack.selfcheck.ts`, `node infrastructure/youtrack/issues.selfcheck.ts` -- all clean/passing after patches. Re-ran the real-DB check: `listBacklogIssues` against the real repo still returns the exact `NOT_CONFIGURED_MESSAGE` end-to-end after the shared-constant refactor.

## Suggested Review Order

**Domain: the configured-or-not gate**

- `listBacklogIssues` -- delegates to the port only when configured; the review-patch `NOT_CONFIGURED_MESSAGE` export closes the string-duplication gap all three review layers independently flagged.
  [`youtrack.ts:120`](../../domain/youtrack.ts#L120)

**Infrastructure: the real MCP adapter and its parsing**

- `youTrackIssuesAdapter` -- the real `search_issues`/`get_issue` calls, now with per-call timeouts and a `NO_DATA`-vs-empty-list distinction (review-patch).
  [`issues.ts:161`](../../infrastructure/youtrack/issues.ts#L161)

- `extractToolResultData` -- the real MCP `CallToolResult` envelope handling; review-patch fix tries every text block, not just the first.
  [`issues.ts:37`](../../infrastructure/youtrack/issues.ts#L37)

- `extractIssueList` / `extractEstimateHours` -- the tolerant-parsing functions with the most review-patch fixes (empty-string `idReadable` fallback, `{presentation}` Period parsing, rounding).
  [`issues.ts:63`](../../infrastructure/youtrack/issues.ts#L63)
  [`issues.ts:124`](../../infrastructure/youtrack/issues.ts#L124)

- `issues.selfcheck.ts` -- the review-patch addition closing the "untested even against fakes" gap for all of the above.
  [`issues.selfcheck.ts:1`](../../infrastructure/youtrack/issues.selfcheck.ts#L1)

**UI**

- `BacklogDrawer` -- the review-patch refetch-on-every-open fix (previously fetched only once ever) and the unmount guard.
  [`backlog-drawer.tsx:23`](../../app/(pm)/sprint/backlog-drawer.tsx#L23)

- The connection form's "Project ID" relabel -- clarifies the field feeding directly into the backlog search query, per Blind Hunter's query-injection-adjacent finding.
  [`youtrack-connection-form.tsx:37`](../../app/(pm)/settings/youtrack-connection-form.tsx#L37)

**Peripheral**

- `Sheet`'s `isolate` class and close-button offset fixes, bringing it to actual parity with `Dialog` as the code comment already claimed.
  [`sheet.tsx:40`](../../components/ui/sheet.tsx#L40)
