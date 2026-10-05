---
title: 'Shared Read-Only Team View'
type: 'feature'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Everything built in Epics 1-4 is only reachable through the PM's own editing surface. A team member has no way to see the current Sprint plan without asking the PM directly or getting screen-shared to.

**Approach:** One standing, unguessable link (`/share/[token]`) that renders the same Sprint Plan content read-only, with no login and no nav chrome. AD-4 requires this route (and everything it imports) to be structurally incapable of reaching a write-capable Server Action — satisfied by extracting the Sprint Plan Overview's read-only data-loading (`app/sprint-plan-data.ts`) and presentation (`components/sprint-plan-content.tsx`) out of `app/page.tsx` into two shared, action-free modules that both the PM's own page and this new route render.

## Boundaries & Constraints

**Always:**
- `prisma/schema.prisma` + migration: add `ShareToken { id String @id; token String }` — a singleton row (fixed `"singleton"` id, mirroring `YouTrackConfig`'s exact pattern), holding the one standing app-level token.
- `domain/share-token.ts` (new): `ShareToken`/`ShareTokenRepo` types only (`get(): Promise<ShareToken | null>`, `getOrCreate(): Promise<ShareToken>`) — no wrapping domain function needed, since there's no user input to validate (the token is server-generated, never submitted by anyone).
- `infrastructure/db/share-token-repository.ts` (new): implements `ShareTokenRepo`; `getOrCreate` upserts the singleton row, generating the token via `crypto.randomUUID()` (Node's built-in) only on first creation — an existing token is never regenerated.
- `app/sprint-plan-data.ts` (new): `getSprintPlanData()` — the exact data-fetching and Capacity/breakdown/assigned-issue computation currently inline in `app/page.tsx`, extracted verbatim (same repos, same domain functions, same results), returning a single fully-resolved data object or `null` (no active Sprint). Imports only repositories and `domain/*` — never `app/actions/*`.
- `components/sprint-plan-content.tsx` (new): the Sprint Capacity / Roster / Assigned Backlog Issues JSX currently inline in `app/page.tsx`, extracted verbatim into a pure presentational component taking `getSprintPlanData()`'s output as props. Same AD-4 import restriction.
- `app/page.tsx` (rewrite): calls `getSprintPlanData()` and renders `<SprintPlanContent>` plus its own PM-only additions around it (unchanged: `CloseSprintDialog`, the Velocity History link, `CreateSprintForm` in the empty state) — behavior identical to today, just reorganized. Also add a link to `/share/{token}` (via `shareTokenRepository.getOrCreate()`) so the PM has a way to find their own standing link — not explicit in the AC, but the feature is unusable without it (UJ-1's "the Team View link is already live" only holds if the PM can see what it is).
- `app/share/[token]/page.tsx` (new): looks up the stored token via `shareTokenRepository.get()`, compares against the URL's `token` param (a plain equality check — AD-5/epic-4-context both frame this as defense-in-depth, not real access control, so no extra hardening is warranted), calls `next/navigation`'s `notFound()` on any mismatch or missing token, otherwise calls `getSprintPlanData()` and renders `<SprintPlanContent>` with no PM-only chrome around it (no `CloseSprintDialog`, no `CreateSprintForm`, no Velocity History link) — matching EXPERIENCE.md's "no nav chrome at all."
- The empty-state ("no active Sprint") text is *not* shared between the two routes: `app/page.tsx` keeps `CreateSprintForm` (a write action); `app/share/[token]/page.tsx` shows a plain "No active Sprint right now." message with nothing actionable.

**Ask First:** _None known._

**Never:**
- No module reachable from `app/share/[token]/page.tsx` may import anything from `app/actions/*` — this is AD-4's literal, structural rule, not just a behavioral goal. `getSprintPlanData()` and `SprintPlanContent` must both be verified import-clean.
- No per-viewer personalization (no "(you)" highlighting, no viewer-scoped "your assigned issues" filtering) — the mockup shows this, but AD-5 means there is no login/session with which to know who's viewing. Show the same team-wide view everyone sees.
- No token rotation, no per-Sprint tokens — exactly one standing token that always reflects whichever Sprint is currently active (AD-4's explicit rule).
- No caching/static-generation directive on the share route — it must read live on every request (the same dynamic-rendering-by-default behavior every other page in this app already has, just don't accidentally opt out of it).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| VALID_TOKEN_ACTIVE_SPRINT | Correct token, an active Sprint exists | Roster, Capacity, Leave/Holidays, and assigned Backlog Issues all render, read-only | N/A |
| VALID_TOKEN_NO_ACTIVE_SPRINT | Correct token, no active Sprint | A plain "No active Sprint right now." message, no form, no error | N/A |
| INVALID_TOKEN | Wrong or malformed token in the URL | 404 (`notFound()`) — never a distinguishable "wrong token" vs "route doesn't exist" message | N/A |
| NO_TOKEN_EVER_CREATED | `ShareToken` row doesn't exist yet and the PM has never visited their own page | 404 for any `/share/*` URL (nothing to match against) | N/A |
| PM_FIRST_VISIT_CREATES_TOKEN | PM opens their own Sprint Plan Overview for the first time | `getOrCreate()` lazily provisions the singleton token; the same link is shown on every subsequent visit, never regenerated | N/A |
| LIVE_UPDATE_NO_REFRESH_PROMPT | A PM-side edit (e.g. emergency leave) happens while the Team View tab is already open | The next time the Team View is loaded/reloaded, it reflects the change directly — no toast/banner asking the viewer to refresh (pull-based, not push, per epic-4-context) | N/A |
| WRITE_UNREACHABLE | Any attempt to find an edit control on the Team View | None exist — no forms, no buttons that mutate anything, no links to any PM-only page | N/A |

</frozen-after-approval>

## Code Map

- `app/page.tsx` — the current inline implementation being split; every line of its data-fetching/computation and its Sprint Capacity/Roster/Assigned Issues JSX moves into the two new shared modules below, verbatim.
- `app/sprint-plan-data.ts` (new) — the extracted data loader.
- `components/sprint-plan-content.tsx` (new) — the extracted presentation.
- `app/share/[token]/page.tsx` (new) — the Team View route.
- `domain/share-token.ts`, `infrastructure/db/share-token-repository.ts` (new).
- `infrastructure/db/youtrack-config-repository.ts` — the exact singleton-row pattern (`SINGLETON_ID` constant, `upsert`) this story's share-token repository mirrors.
- `prisma/schema.prisma:98-106` — `YouTrackConfig`'s singleton-id convention, mirrored for `ShareToken`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma` + migration -- `ShareToken` model.
- [ ] `domain/share-token.ts` (new) -- types.
- [ ] `infrastructure/db/share-token-repository.ts` (new) -- `get`, `getOrCreate`.
- [ ] `app/sprint-plan-data.ts` (new) -- extracted data loader.
- [ ] `components/sprint-plan-content.tsx` (new) -- extracted presentation.
- [ ] `app/page.tsx` -- rewritten to use both, plus the share-link display.
- [ ] `app/share/[token]/page.tsx` (new) -- the Team View route.

**Acceptance Criteria:**
- Given the shared Team View link containing its unguessable token, when I open it without logging in, then I see the current Sprint's roster, capacity, leave, holidays, and assigned issues.
- Given I am viewing the shared Team View, when I look for any way to edit roster, leave, allocations, or the sprint plan, then no such controls exist — the view is read-only, with all write actions unreachable from this route.
- Given the PM's own session and the shared Team View are both open, when something changes (e.g. emergency leave logged), then the Team View reflects the updated Capacity without any separate notification step.

## Design Notes

The mockup's "(you)" row-highlighting and per-viewer "your assigned issues" table are not built — there is no login/session (AD-5) to know who's viewing, so a personalized view is architecturally impossible without adding the auth system this product explicitly excludes. Every viewer sees the identical, full team-wide view; a team member finds their own row/issues by reading, the same as everyone else's.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- A manual import-graph check (grep) confirming `app/sprint-plan-data.ts` and `components/sprint-plan-content.tsx` never reference `app/actions/` -- the structural half of AD-4 that a type-checker can't verify on its own.
- Real-DB check (synthetic fixtures, cleaned up after): confirm the correct token renders the full Sprint Plan content read-only; confirm a wrong token 404s; confirm `app/page.tsx`'s own rendering is unchanged after the extraction (a regression check against Stories 4.1-4.3's already-verified behavior).

**Manual checks (if no CLI):**
- Visual check that no edit affordance of any kind appears anywhere on `/share/[token]`.

## Suggested Review Order

- [domain/share-token.ts](../../domain/share-token.ts), [infrastructure/db/share-token-repository.ts](../../infrastructure/db/share-token-repository.ts)
- [app/sprint-plan-data.ts](../../app/sprint-plan-data.ts), [components/sprint-plan-content.tsx](../../components/sprint-plan-content.tsx) — the extraction; verify these truly never import `app/actions/*`.
- [app/share/[token]/page.tsx](../../app/share/[token]/page.tsx) — the new route.
- [app/page.tsx](../../app/page.tsx) — confirm the PM's own page is behavior-preserving after the extraction.

### Results (2026-08-20, review_loop_iteration 1)

- `npx tsc --noEmit` — clean (one transient Turbopack worker crash on this session's first-ever compile of the new dynamic route, resolved by clearing a stale `.next` cache and restarting — not a code defect).
- `npm run lint` — clean.
- No new selfcheck: `domain/share-token.ts` is types only (no user input to validate), and `getSprintPlanData()`/`SprintPlanContent` are a data loader and a presentational component, neither fitting this project's pure-function selfcheck pattern.
- A grep-based import-graph check confirming zero actual `import ... from "@/app/actions/..."` statements anywhere in `app/sprint-plan-data.ts`, `components/sprint-plan-content.tsx`, or `app/share/[token]/page.tsx` — the structural half of AD-4 a type-checker alone can't verify.
- Real-DB checks via disposable routes (synthetic fixtures only, all cleaned up, confirmed zero rows remain), across two passes:
  - First pass: confirmed the home page lazily generates a real share token and displays its link; followed the real link with no active Sprint (showed "Read Only" + "No active Sprint right now.", not the PM's `CreateSprintForm`); confirmed a wrong token 404s; created a synthetic active Sprint + Team Member + assigned issue and confirmed the Team View renders Sprint Capacity/Roster/Assigned Backlog Issues correctly with **zero** `<form>`/`<button>`/`<select>`/`<input>` elements anywhere on the page; confirmed the PM's own page still renders the identical data plus its own `Close Sprint` button (present there, absent from the Team View) — a regression check that the extraction didn't change the PM's own page.
  - Second pass (closing Verification Gap's remaining items): deleted the `ShareToken` row entirely and confirmed `/share/<anything>` 404s with zero rows before and after (`NO_TOKEN_EVER_CREATED`, distinct from "wrong token but a real one exists"); confirmed the no-Dev-category and empty-assigned-issues fallbacks render correctly on the Team View (the real DB's existing Team Member made the empty-roster fallback itself untestable without touching real data — logged, same reasoning as Story 4.1's identical gap); logged emergency leave for a synthetic member, then reloaded the already-fetched Team View URL and confirmed the new "Emergency Leave" chip appeared directly, with no separate refresh-prompt step (`LIVE_UPDATE_NO_REFRESH_PROMPT`).
- Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) — no code defects found by any layer. Edge Case Hunter additionally ran its own live Postgres check of `ShareTokenRepo.getOrCreate()`'s upsert atomicity (two concurrent first-ever calls, confirmed they return the identical token, no split-brain) and flagged one inaccurate code comment, corrected below. Two residual verification gaps logged as deferred (a full production-build smoke check; the same real-data constraint on `NO_TEAM_MEMBERS` already logged for Story 4.1).

**Patch applied after review:**
- `infrastructure/db/share-token-repository.ts`'s comment claiming its `upsert` shape "mirrors youtrack-config-repository.ts's identical pattern" was corrected — the fixed-singleton-PK convention matches, but the `update: {}` no-op payload does not (YouTrack's `update` always carries real data); the comment now also records the concurrency behavior Edge Case Hunter verified live (Edge Case Hunter).
