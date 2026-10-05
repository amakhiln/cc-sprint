---
title: 'Connect to YouTrack'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every Sprint-planning feature so far manages roster/allocation/leave data the PM types in by hand — there's no way to bring real tracked work from YouTrack into a Sprint, which is the whole point of Epic 3.

**Approach:** Add a `YouTrackConfig` singleton (instance URL, project, auth token — server-side only), a `domain/youtrack.ts` validate-then-test-then-persist function, and a real `infrastructure/youtrack/` adapter wrapping the actual installed `@modelcontextprotocol/client` SDK to test connectivity before saving. A new `/settings` page hosts the connection form. **Known constraint, disclosed to the human up front:** no YouTrack MCP server is reachable from this environment this pass — the adapter is implemented correctly against the real SDK's API (verified by reading its installed type definitions, not assumed), but the actual "does it successfully talk to a real YouTrack server" path is unverifiable here and must be checked once a real connection exists.

## Boundaries & Constraints

**Always:**
- `prisma/schema.prisma`: `model YouTrackConfig { id String @id @default(cuid()); instanceUrl String; authToken String; projectId String }`. Singleton via a fixed, hardcoded id (`"singleton"`) as the primary key — every read/write targets that one id, so exactly one row can ever exist; no extra unique index needed (unlike `Sprint`/`AllocationCategory`'s "at most one *true*" problem, this is "at most one row, period," which a fixed PK solves directly).
- `domain/youtrack.ts` (new, framework-free): `YouTrackConfig = {instanceUrl, projectId, authToken}`; `YouTrackConfigRepo = {get(): Promise<YouTrackConfig|null>; save(data): Promise<YouTrackConfig>}`; `YouTrackConnectionTester = {test(config): Promise<{ok:true}|{ok:false,error:string}>}` (an injected port — domain never imports the MCP client directly, AD-1); `saveYouTrackConfig(repo, tester, input)`: trim + require `instanceUrl`/`projectId`/`authToken`, validate `instanceUrl` via `new URL(...)` (reject on throw), call `tester.test(...)` **before** persisting, return `{ok:false, error}` on either validation or test failure without ever calling `repo.save`. On success, `repo.save(...)` then return `{ok:true, data:{instanceUrl, projectId}}` — **never** include `authToken` in the returned `data` (it must never reach a Server Action's client-visible return value).
- `infrastructure/db/youtrack-config-repository.ts`: implement `YouTrackConfigRepo` via `prisma.youTrackConfig.findUnique`/`upsert` keyed on the fixed `"singleton"` id.
- `infrastructure/youtrack/client.ts` (new — the only module importing `@modelcontextprotocol/client`, already installed as a real dependency this pass): implement `YouTrackConnectionTester` using the SDK's real API — `new Client({name, version})`, `new StreamableHTTPClientTransport(new URL(instanceUrl), {authProvider: {token: async () => authToken}})`, `await client.connect(transport, {timeout: 10_000})`, `await client.ping()`, `await client.close()` in a `finally`. Catch and translate: invalid URL construction → "Instance URL must be a valid URL"; an `UnauthorizedError` (imported from the same package) → "The auth token was rejected — check that it's valid and not expired"; any other thrown error → a generic "Could not reach the YouTrack server. Check the instance URL and try again." Never let a thrown error escape uncaught.
- `app/actions/youtrack.ts` (new): `saveYouTrackConfigAction(formData)` — parse `instanceUrl`/`projectId`/`authToken` strings, call `saveYouTrackConfig` with the real repo + real tester, `revalidatePath("/settings")` on success (same try/catch-and-log pattern as every other Server Action in this codebase).
- `app/(pm)/settings/page.tsx` (new route) + `app/(pm)/settings/youtrack-connection-form.tsx` (new): Server Component fetches the current config via the repo and passes only `instanceUrl`/`projectId` (never `authToken`) as `defaultValue`s to the Client Component form; the auth token field always renders blank regardless of whether a connection already exists. Show the current `instanceUrl`/`projectId` as a small "Currently connected" summary above the form when configured. Form errors render inline (`role="alert"`), mirroring `create-sprint-form.tsx`'s `useActionState` pattern exactly — no toast.

**Ask First:** _None known — the missing-MCP-server constraint was already raised and the human chose to proceed._

**Never:**
- No backlog browsing, issue pulling, or issue assignment — Stories 3.2/3.3/3.4's job. This story only saves and validates one connection.
- No encryption-at-rest for the stored auth token — matches this app's existing security posture (AD-5: no auth system, the editing surface is protected by network placement, not per-secret hardening); revisit only if that posture ever changes.
- No global nav link to `/settings` — this app has no shared nav chrome yet (every existing route — `/roster`, `/sprint`, `/leave` — is reached by direct URL); adding one is out of scope here and belongs to Epic 4's Sprint Plan Overview hub, per EXPERIENCE.md's IA.
- No retry/backoff logic in the connection tester beyond the SDK's own defaults — a single connect-and-ping attempt is enough to satisfy this story's AC.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Valid-shaped URL, project, token; tester returns `{ok:true}` | Config is saved; `{ok:true, data:{instanceUrl, projectId}}` returned, no `authToken` in the result | N/A |
| INVALID_URL | `instanceUrl` = `"not a url"` | Rejected before the tester is ever called | `{ok:false, error:"Instance URL must be a valid URL"}` |
| UNREACHABLE_OR_REJECTED | Tester returns `{ok:false, error}` (unreachable server, invalid/expired token, etc.) | Nothing is persisted — `repo.save` is never called | The tester's own error message is returned verbatim |
| BLANK_FIELD | Any of `instanceUrl`/`projectId`/`authToken` empty/whitespace-only | Rejected before the tester is ever called | A field-specific "is required" message |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — add `YouTrackConfig` model; migrate via `npx prisma migrate dev --name add_youtrack_config`.
- `domain/allocation.ts:148` `addAllocationCategory` — the validate-then-persist shape to mirror (trim, reject on invalid, single happy path to `repo.create`).
- `domain/sprint.ts:45-84` `createSprint` — the closest existing precedent for "validate, then an external check (the active-Sprint pre-check), then persist, never a raw throw to the caller."
- `infrastructure/db/sprint-repository.ts` — existing repo-implementation pattern (plain async methods matching the domain port) to mirror for `youtrack-config-repository.ts`.
- `node_modules/@modelcontextprotocol/client/dist/index.d.mts` — the real, already-installed SDK's type definitions. Key exports confirmed by reading this file directly (not assumed): `Client` (constructor `(clientInfo: {name,version}, options?)`), `StreamableHTTPClientTransport` (constructor `(url: URL, opts?: {authProvider?, ...})`), `AuthProvider` (`{token(): Promise<string|undefined>}`), `client.connect(transport, options?)`, `client.ping()`, `client.close()`, `UnauthorizedError` class.
- `app/(pm)/sprint/create-sprint-form.tsx` — the exact `useActionState` + inline-error form pattern to mirror for `youtrack-connection-form.tsx`.
- `app/actions/sprint.ts` — the exact Server Action try/catch/`revalidatePath` shape to mirror for `youtrack.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` -- add `YouTrackConfig` model -- migrate.
- [x] `domain/youtrack.ts` (new) -- `saveYouTrackConfig`, the `YouTrackConfigRepo`/`YouTrackConnectionTester` ports.
- [x] `domain/youtrack.selfcheck.ts` (new) -- covers the I/O matrix using a fake repo + fake tester (never the real MCP client).
- [x] `infrastructure/db/youtrack-config-repository.ts` (new) -- `YouTrackConfigRepo` via the fixed-id singleton.
- [x] `infrastructure/youtrack/client.ts` (new) -- `YouTrackConnectionTester` via the real `@modelcontextprotocol/client` SDK.
- [x] `app/actions/youtrack.ts` (new) -- `saveYouTrackConfigAction`.
- [x] `app/(pm)/settings/page.tsx`, `app/(pm)/settings/youtrack-connection-form.tsx` (new) -- the connection form + current-connection summary.

**Acceptance Criteria:**
- Given no `YouTrackConfig` row exists yet, when I open `/settings`, then I see a blank form with no "currently connected" summary.
- Given a `YouTrackConfig` row already exists, when I open `/settings`, then the form's `instanceUrl`/`projectId` fields are pre-filled and the auth token field is blank.

## Design Notes

The connection tester is a domain-level *port* (`YouTrackConnectionTester`), not something `saveYouTrackConfig` constructs itself — this keeps `domain/youtrack.ts` framework-free (AD-1) and makes the self-check possible without touching the real MCP client or network at all, the same way every other domain function in this codebase is tested against a fake in-memory repo rather than a real database.

## Verification

**Commands:**
- `npx prisma migrate dev --name add_youtrack_config` -- expected: applies against the live Supabase connection.
- `npx tsc --noEmit` -- expected: no type errors (this also confirms the real SDK's types are used correctly, since nothing here is mocked at the type level).
- `npm run lint` -- expected: clean.
- `node domain/youtrack.selfcheck.ts` -- expected: all assertions pass, using a fake tester (never the real SDK/network).
- `npm run dev` + manually: open `/settings`, submit a blank form (each field's required error), submit a syntactically-invalid URL, submit a well-formed but fake instance URL/token (expected to fail via the real tester's own error handling against an unreachable host — confirms the tester's error path works, even without a real YouTrack server).

**Manual checks (if no CLI):**
- **Explicitly cannot be verified this pass:** the tester's success path against a real, reachable YouTrack MCP server with valid credentials. Flag this to the human and log it in `deferred-work.md` rather than claiming it works.

**Results (2026-08-19 pass):**

- The first implementation attempt was interrupted mid-task by an API connection error after completing `domain/youtrack.ts`, `domain/youtrack-config-repository.ts`, and `infrastructure/youtrack/client.ts`, but before the migration, self-check, or Settings page/form. Completed the remainder directly: ran `npx prisma migrate dev --name add_youtrack_config` (applied against the live Supabase DB), wrote `domain/youtrack.selfcheck.ts`, and wrote `app/(pm)/settings/page.tsx` + `youtrack-connection-form.tsx` + `error.tsx` (the last one matching every other route's existing error-boundary convention, not explicitly listed in Tasks but a mechanical, zero-judgment addition). Also removed a stray `infrastructure/youtrack/README.md` the interrupted agent left behind, not part of the spec.
- `npx tsc --noEmit`, `npm run lint` -- both clean (after an explicit `npx prisma generate` -- `migrate dev` alone didn't leave `PrismaClient` regenerated with the new model in this pass).
- `node domain/youtrack.selfcheck.ts` -- all assertions passed: HAPPY_PATH (fake tester), INVALID_URL, UNREACHABLE_OR_REJECTED, BLANK_FIELD (all three fields).
- **Real-DB + real-network check** (kept pattern from prior stories, via a temporary API route, deleted after use): called `saveYouTrackConfig` with the real repo and the real `youTrackConnectionTester` against the live Supabase DB. Blank URL → "Instance URL is required"; syntactically invalid URL → "Instance URL must be a valid URL"; a well-formed but genuinely nonexistent hostname → a real DNS/connection failure, correctly translated to "Could not reach the YouTrack server. Check the instance URL and try again." in 150ms, with zero rows persisted after any of the three attempts. This confirms the adapter makes a real network call and handles real failure correctly, not just a mocked path.
- **Real-render check:** seeded a real `YouTrackConfig` row directly, confirmed `/settings`'s SSR HTML pre-fills `instanceUrl`/`projectId` correctly and the auth-token input renders with no `value` attribute at all -- grepped the full rendered HTML (including the RSC streaming payload) for the seeded token string and got zero matches, confirming the token never reaches the client in any form. Reverted the seeded row afterward.
- **Still explicitly unverified, as disclosed in the spec up front:** the tester's success path against a real, reachable YouTrack MCP server with valid credentials, and the `UnauthorizedError` (401) translation path specifically -- both require a real YouTrack MCP server, which doesn't exist in this environment. Logged to `deferred-work.md`.

**Results (2026-08-19 review-patch pass):**

Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) ran against the diff. Patched:

- `domain/youtrack.ts` -- reject non-http(s) URL schemes (`javascript:`, `file:`, etc.) before the tester is ever called; added max-length guards on `instanceUrl`/`projectId`/`authToken` (matching `domain/allocation.ts`'s `MAX_NAME_LENGTH` convention).
- `infrastructure/youtrack/client.ts` -- moved `new Client(...)`/`new StreamableHTTPClientTransport(...)` inside the `try` block (they could previously throw uncaught, escaping the `{ok:false}` contract and skipping `client.close()`); added the same 10s timeout to `client.ping()` that `client.connect()` already had (a server that accepts the connection but hangs on ping could otherwise block indefinitely); the generic non-401 failure branch now `console.error`s the real underlying error before returning the friendly message, matching every other Server Action/adapter in this codebase.
- `infrastructure/db/youtrack-config-repository.ts` -- `get()`/`save()` now `select` exactly the port's `{instanceUrl, projectId, authToken}` shape instead of returning the raw Prisma row (which also carried `id`), closing a structural-typing gap where a future caller could accidentally forward more than the port promises.
- `app/(pm)/settings/youtrack-connection-form.tsx` -- `autoComplete="off"` (unreliable on password fields in modern browsers) → `autoComplete="new-password"`; softened the Instance URL placeholder/added a caption clarifying it means "the full MCP server URL" rather than implying a bare root URL is always correct (the actual required path is server-dependent and unknowable without a real server to check against).
- `domain/youtrack.selfcheck.ts` -- added TRIMMED (whitespace-only-padding still saves the trimmed value), NON_HTTP_SCHEME, TOO_LONG, and REPO_SAVE_THROWS (a thrown `repo.save` propagates rather than being swallowed) cases.

Deferred (see `deferred-work.md`): `projectId` is never actually verified against the connected instance (Story 3.2's territory once the real browse-tool contract exists); no way to disconnect/clear a saved connection (new scope, no AC requires it); the generic error message still conflates several distinct failure classes (needs real-server-validated SDK error-type knowledge); no ongoing re-verification of an existing connection's health; `saveYouTrackConfigAction`'s own FormData/try-catch/revalidate wiring never exercised end-to-end (same standing Playwright-unreachable gap already logged for five prior stories).

Rejected as already-decided in the frozen spec: plain-text token storage (the spec's own Never clause already addresses this — matches AD-5's existing trusted-network security posture); no nav link to `/settings` (the spec's own Never clause already explicitly scopes this out — no shared nav exists yet anywhere in the app).

Re-ran `npx tsc --noEmit`, `npm run lint`, `node domain/youtrack.selfcheck.ts` -- all clean/passing after patches. Re-ran the real-DB + real-network check: non-http(s) scheme and over-long-field rejections now fire correctly; the unreachable-host failure is now visibly logged server-side (`console.error("YouTrack connection test failed:", ...)` — confirmed in the dev server's own log output) before returning the generic message; `youTrackConfigRepository.get()`'s returned keys are now exactly `["authToken", "instanceUrl", "projectId"]`, confirming the `select`-shape narrowing works. Fixtures reverted afterward; zero leftover rows.

## Suggested Review Order

**Domain: validate → test → persist**

- `saveYouTrackConfig` -- the frozen validate-then-test-then-persist sequence; review-patch additions are the scheme/length guards, applied before the tester is ever called.
  [`youtrack.ts:37`](../../domain/youtrack.ts#L37)

- `youtrack.selfcheck.ts` -- covers the I/O matrix plus the review-patch cases (trimming, non-http scheme, over-length, a thrown `repo.save` propagating rather than being swallowed).
  [`youtrack.selfcheck.ts:1`](../../domain/youtrack.selfcheck.ts#L1)

**Infrastructure: the real MCP adapter and the real-server-unverifiable boundary**

- `youTrackConnectionTester` -- the real `@modelcontextprotocol/client` usage; review-patch fixes moved the client/transport construction inside the `try` block and added a `ping()` timeout to match `connect()`'s.
  [`client.ts:11`](../../infrastructure/youtrack/client.ts#L11)

- `youTrackConfigRepository` -- the fixed-`"singleton"`-id pattern and the review-patch `select`-shape narrowing (never returns more than the port promises).
  [`youtrack-config-repository.ts:12`](../../infrastructure/db/youtrack-config-repository.ts#L12)

**UI**

- `saveYouTrackConfigAction` -- the Server Action wiring; still unverified end-to-end via a real form submission (see Verification Results and `deferred-work.md`).
  [`youtrack.ts:8`](../../app/actions/youtrack.ts#L8)

- The Settings page/form -- confirms `authToken` never reaches the client in any form (verified by grepping the full rendered HTML for a seeded token).
  [`page.tsx:1`](../../app/(pm)/settings/page.tsx#L1)
  [`youtrack-connection-form.tsx:1`](../../app/(pm)/settings/youtrack-connection-form.tsx#L1)
