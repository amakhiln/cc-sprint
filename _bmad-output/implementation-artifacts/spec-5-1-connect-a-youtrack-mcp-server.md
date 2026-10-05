---
title: 'Connect a YouTrack MCP Server'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Query Assistant (Epic 5) needs a live, read-only source of YouTrack data, but the PM has no way to configure one — the existing `YouTrackConfig` is a REST-only connection (AD-3) with no MCP dependency anymore.

**Approach:** Add a second, independent connection type — server URL, auth token, project ID — stored in a new `YouTrackMcpConfig` row, validated on save against the real MCP server, with a fixed read-only tool allowlist that is the single source of truth for what the assistant may ever call.

## Boundaries & Constraints

**Always:**
- `authToken` is stored server-side only in `YouTrackMcpConfig`, never sent to the client (mirror `YouTrackConfig`'s pattern).
- The allowlist is deny-by-default: only tool names explicitly listed in one shared constant are ever registered, and that same constant is what a later story advertises to the LLM.
- `YouTrackMcpConfig` and its adapter (`infrastructure/youtrack-mcp/`) stay fully separate from `infrastructure/youtrack/` (REST, AD-3) — no shared module, no assumption the two `projectId`s match.

**Ask First:** none — the tool-list verification gap (AD-7 Deferred note) was resolved live against `https://admarentech.myjetbrains.com/mcp` on 2026-08-25 (see Design Notes).

**Never:**
- Never register or advertise a write-capable tool (`create_issue`, `update_issue`, `add_issue_comment`, `manage_issue_tags`, `link_issues`, `change_issue_assignee`, `log_work`, `create_draft_issue`, `create_article`, `update_article`), regardless of what the server's own `readOnlyHint` annotation claims.
- Never build the LLM tool-calling loop or chat UI here — out of scope, Story 5.2.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Valid URL + token + project short name | `listTools` succeeds, `find_projects` finds the project → row saved, authToken excluded from the returned data | N/A |
| INVALID_URL | Blank, malformed, or non-http(s) URL | Rejected before any network call | Inline error, nothing saved |
| BAD_TOKEN | Valid URL, invalid/expired token | `connect`/`listTools` fails | Inline error, nothing saved |
| BAD_PROJECT | Valid URL + token, unknown project short name | `find_projects` returns no match | Inline error, nothing saved |
| TOOL_FILTER | Full 23-tool live list (13 read, 10 write) | Registry-building returns exactly the 13 allowlisted names | N/A — proven by selfcheck fixture |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- add `model YouTrackMcpConfig` next to `YouTrackConfig` (singleton fixed-id pattern, line ~98)
- `domain/youtrack-mcp.ts` (new) -- mirrors `domain/youtrack.ts`: `YouTrackMcpConfig`/`YouTrackMcpConfigRepo`/`YouTrackMcpConnectionTester` types + `saveYouTrackMcpConfig()` validate-then-test-then-persist function
- `infrastructure/youtrack-mcp/tool-allowlist.ts` (new) -- `READ_ONLY_TOOL_NAMES` (the 13 verified read tools) + `filterToAllowedTools()`, the one shared filter used everywhere
- `infrastructure/youtrack-mcp/client.ts` (new) -- `youTrackMcpConnectionTester` (connects via `StreamableHTTPClientTransport` + `authProvider: {token}`, `listTools()`, then `callTool({name:"find_projects", arguments:{query: projectId}})` to prove the project too) + `getReadOnlyToolRegistry(config)` (connects, lists, filters via `filterToAllowedTools`, closes)
- `infrastructure/db/youtrack-mcp-config-repository.ts` (new) -- mirrors `infrastructure/db/youtrack-config-repository.ts` exactly (singleton id, `CONFIG_SELECT`)
- `app/actions/youtrack-mcp.ts` (new) -- `saveYouTrackMcpConfigAction(formData)`, mirrors `app/actions/youtrack.ts:9-47`
- `app/(pm)/settings/youtrack-mcp-connection-form.tsx` (new) -- mirrors `youtrack-connection-form.tsx`'s `useActionState` + inline `role="alert"` pattern
- `app/(pm)/settings/page.tsx` -- add a second `<section className="glass">` block (line ~59) reading `youTrackMcpConfigRepository.get()`, same layout as the existing REST section

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` -- add `YouTrackMcpConfig` model, then `npx prisma migrate dev --name add_youtrack_mcp_config` -- new persistence target
- [x] `domain/youtrack-mcp.ts` -- types + `saveYouTrackMcpConfig()` -- validation/persist logic, framework-free (AD-1)
- [x] `domain/youtrack-mcp.selfcheck.ts` -- happy path, invalid URL, non-http scheme, blank/too-long fields, tester failure, repo.save throw -- mirrors `domain/youtrack.selfcheck.ts`
- [x] `infrastructure/youtrack-mcp/tool-allowlist.ts` -- allowlist constant + filter fn -- single source of truth for read-only enforcement
- [x] `infrastructure/youtrack-mcp/tool-allowlist.selfcheck.ts` -- fixture of all 23 live tool names asserts exactly the 13 read-only ones pass, and an unlisted/unknown tool name never passes -- proves deny-by-default
- [x] `infrastructure/youtrack-mcp/client.ts` -- real MCP adapter implementing the domain port -- the only module importing `@modelcontextprotocol/client` for this feature
- [x] `infrastructure/db/youtrack-mcp-config-repository.ts` -- Prisma repo implementing `YouTrackMcpConfigRepo`
- [x] `app/actions/youtrack-mcp.ts` -- Server Action wiring repo + tester, `revalidatePath("/settings")` on success
- [x] `app/(pm)/settings/youtrack-mcp-connection-form.tsx` -- client form (MCP Server URL, Project ID, Auth Token)
- [x] `app/(pm)/settings/page.tsx` -- render the new section, never pass `authToken` to the client

**Acceptance Criteria:**
- Given valid MCP server URL, project, and auth token, when I save, then the row persists in `YouTrackMcpConfig`, separate from `YouTrackConfig`
- Given an invalid URL, invalid/expired token, or unreachable server, when I try to save, then a clear inline error is shown and nothing is saved
- Given a saved connection, when the tool registry is built, then only the 13 allowlisted read tools are ever returned, even if the live server's tool list changes shape

## Spec Change Log

## Design Notes

Live-verified 2026-08-25 against `https://admarentech.myjetbrains.com/mcp` (the existing `YouTrackConfig` row, saved pre-REST-migration, still holds working MCP credentials for this instance) via `client.listTools()`. Resolves the architecture's AD-7 Deferred item ("Live MCP tool-list verification... before implementing Story work for FR-25/FR-26").

23 tools total. Read-only (`readOnlyHint: true`), → the allowlist:
`search_issues, get_issue, get_issue_comments, get_issue_fields_schema, get_saved_issue_searches, search_articles, get_article, get_project, find_projects, find_user, find_user_groups, get_user_group_members, get_current_user`

Write-capable (`readOnlyHint: false`), never allowlisted:
`create_issue, update_issue, add_issue_comment, manage_issue_tags, link_issues, change_issue_assignee, log_work, create_draft_issue, create_article, update_article`

Note for Story 5.2/5.3 planning: no dedicated time-tracking **read** tool exists on this server (only `log_work`, which is write-only) — a "how many hours logged" question may need `get_issue`'s fields or another approach; not this story's problem to solve, just flagging it forward.

The allowlist is a hardcoded name list, not a runtime filter on the server's own `readOnlyHint` annotation — a compromised or misconfigured server could mark a write tool `readOnlyHint: true`, and this app must not trust that (AD-7's "fixed, reviewed allowlist" over "server-declared metadata").

## Verification

**Commands:**
- `node domain/youtrack-mcp.selfcheck.ts` -- expected: all assertions pass
- `node infrastructure/youtrack-mcp/tool-allowlist.selfcheck.ts` -- expected: all assertions pass
- `npx prisma migrate dev --name add_youtrack_mcp_config` -- expected: migration applies cleanly
- `npm run lint` -- expected: no new errors

**Manual checks (if no CLI):**
- In Settings, save a real MCP connection and confirm the inline "Connected" state renders without ever exposing the token in page source or network response bodies.

## Suggested Review Order

**Read-only tool allowlist — the security boundary this story exists to enforce**

- Deny-by-default: only these 13 names are ever registered or advertised, regardless of server hints.
  [`tool-allowlist.ts:13`](../../infrastructure/youtrack-mcp/tool-allowlist.ts#L13)

- The one shared filter every caller runs tool lists through — single source of truth.
  [`tool-allowlist.ts:37`](../../infrastructure/youtrack-mcp/tool-allowlist.ts#L37)

**MCP connection adapter**

- Connects, proves the token, then proves the Project ID via `find_projects` before ever saving.
  [`client.ts:89`](../../infrastructure/youtrack-mcp/client.ts#L89)

- Project-match check (the code-review fix): a non-empty result no longer means "found it."
  [`client.ts:54`](../../infrastructure/youtrack-mcp/client.ts#L54)

- Shallow field scan for the match — ponytail-flagged as a best-effort guess at an undocumented shape.
  [`client.ts:78`](../../infrastructure/youtrack-mcp/client.ts#L78)

- One shared error-message translation point for both `test()` and the registry builder.
  [`client.ts:42`](../../infrastructure/youtrack-mcp/client.ts#L42)

- Bounds `client.close()` so a non-responsive server can't hang the request indefinitely.
  [`client.ts:32`](../../infrastructure/youtrack-mcp/client.ts#L32)

- Story 5.2's future entry point — no caller yet, but now fails clean like `test()` does.
  [`client.ts:151`](../../infrastructure/youtrack-mcp/client.ts#L151)

**Domain validation & persistence flow**

- Validate-then-test-then-persist, mirroring the existing REST config's exact shape (AD-1, framework-free).
  [`youtrack-mcp.ts:41`](../../domain/youtrack-mcp.ts#L41)

- New singleton table, fully separate from `YouTrackConfig` — no shared module, no assumption the IDs match.
  [`schema.prisma:111`](../../prisma/schema.prisma#L111)

- Fixed-id upsert repo; `CONFIG_SELECT` keeps the internal `id` from ever leaking to the port type.
  [`youtrack-mcp-config-repository.ts:13`](../../infrastructure/db/youtrack-mcp-config-repository.ts#L13)

**Server Action & UI wiring**

- Thin wiring: type-guards `FormData`, calls the domain fn, never throws to the caller.
  [`youtrack-mcp.ts:8`](../../app/actions/youtrack-mcp.ts#L8)

- Client form; auth token field is always blank on load since the domain layer never returns it.
  [`youtrack-mcp-connection-form.tsx:8`](../../app/(pm)/settings/youtrack-mcp-connection-form.tsx#L8)

- Second connection section added alongside the existing REST one; `authToken` never passed to the client.
  [`page.tsx:9`](../../app/(pm)/settings/page.tsx#L9)

**Tests**

- Domain-layer selfcheck: happy path, every validation branch, tester failure, `repo.save` throw.
  [`youtrack-mcp.selfcheck.ts:1`](../../domain/youtrack-mcp.selfcheck.ts#L1)

- Adapter selfcheck added during review: the two previously-uncovered branches, network-free.
  [`client.selfcheck.ts:1`](../../infrastructure/youtrack-mcp/client.selfcheck.ts#L1)

- Fixture proves the full 23-tool live list filters to exactly the 13 allowlisted names.
  [`tool-allowlist.selfcheck.ts:1`](../../infrastructure/youtrack-mcp/tool-allowlist.selfcheck.ts#L1)

**Results (2026-08-25 pass):**

- `node domain/youtrack-mcp.selfcheck.ts` -- all assertions passed (HAPPY_PATH, INVALID_URL, NON_HTTP_SCHEME, BLANK_FIELD x3, TOO_LONG, tester-fails, REPO_SAVE_THROWS).
- `node infrastructure/youtrack-mcp/tool-allowlist.selfcheck.ts` -- all assertions passed: the full synthetic 23-tool fixture (13 read + 10 write) filters down to exactly the 13 allowlisted names; every one of the 10 write tools and an unknown/unlisted name are individually confirmed to never pass.
- `npx prisma migrate dev --name add_youtrack_mcp_config` -- applied cleanly against the live Supabase connection (migration `20260825093229_add_youtrack_mcp_config`). `npx prisma generate` was also needed afterward (same gotcha already logged in Story 3.1's results -- `migrate dev` alone doesn't regenerate `PrismaClient`).
- `npx tsc --noEmit` -- clean (confirms the real, installed `@modelcontextprotocol/client` v2 SDK's actual API -- `Client`, `StreamableHTTPClientTransport`, `AuthProvider`, `UnauthorizedError`, `Tool` -- is used correctly, verified by reading its type definitions directly, not assumed).
- `npm run lint` -- clean (0 errors; the one warning present is pre-existing and unrelated, in `app/layout.tsx`).
- **Real-DB check** (via a temporary Next.js route, deleted after use -- never the user's own real `YouTrackConfig`/MCP credentials, per the standing no-real-data-in-verification constraint): round-tripped `youTrackMcpConfigRepository` with synthetic fixture values (`serverUrl: "https://synthetic-fixture.example.com/mcp"`, `projectId: "SYN"`, `authToken: "synthetic-token-do-not-use"`). Confirmed the singleton upsert (`before: null` on a fresh table, then get/save/get all agree), and that `save()`'s returned keys are exactly `["authToken", "projectId", "serverUrl"]` (no `id` leak). Fetched `/settings`'s full rendered HTML with the fixture row in place: the new "YouTrack MCP Connection" section renders "Connected" / the server URL / "Project SYN" correctly, the form's `Project ID` field pre-fills to `"SYN"`, and the literal string `synthetic-token-do-not-use` appears zero times anywhere in the page (including the RSC flight payload). Fixture row deleted and the temporary route removed afterward; confirmed zero `YouTrackMcpConfig` rows remain.
- **Explicitly not verified this pass** (see `deferred-work.md`): the connection tester's and `getReadOnlyToolRegistry`'s actual behavior against a real, reachable YouTrack MCP server -- including whether `findsProject()`'s heuristic parsing of `find_projects`'s response actually recognizes a real match/no-match. The tool-list/allowlist itself (23 tools, 13 read-only) *was* live-verified against `https://admarentech.myjetbrains.com/mcp` per this spec's own Design Notes, but that verification happened prior to this implementation pass, not during it -- this pass deliberately did not drive any call through the existing `YouTrackConfig` row's still-working real credentials, consistent with the standing constraint against using the user's own real data/credentials for verification.
