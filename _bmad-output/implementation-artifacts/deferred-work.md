- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-project-scaffold-from-starter-template.md`
  summary: No test runner or test tooling is configured yet.
  evidence: Blind Hunter review flagged this at scaffold time; the Architecture Spine's own Deferred section already punts the test-runner choice to the builder as low-stakes, so this is a legitimate, already-approved deferral rather than an oversight — revisit once Story 1.2+ starts writing real domain logic.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-project-scaffold-from-starter-template.md`
  summary: No CI workflow (lint/build/typecheck) exists.
  evidence: Blind Hunter review flagged this; the Architecture Spine's Deferred section already lists CI/CD as "add ad hoc, revisit if story cadence justifies it" — consistent with that existing decision, not a new gap.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-project-scaffold-from-starter-template.md`
  summary: Prisma 7's `prisma-client` generator needs a driver adapter package (e.g. `@prisma/adapter-pg`) wired up before any runtime `PrismaClient` usage, and none is installed yet.
  evidence: Blind Hunter review found no adapter package in dependencies and `infrastructure/db/` is still a placeholder — this story only needed schema validation and CLI-level connectivity, not a live client, so nothing breaks yet. Story 1.2 (first story to write real `infrastructure/db/` code) should account for this when wiring up `PrismaClient`.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-project-scaffold-from-starter-template.md`
  summary: `PrismaClient` runtime instantiation should explicitly validate `DATABASE_URL` is set, not rely solely on Prisma CLI-time checks.
  evidence: Edge Case Hunter review noted `prisma.config.ts`'s datasource url has no guard; the CLI happens to fail explicitly today, but CLI-time validation and application-runtime instantiation are different code paths — whoever writes `infrastructure/db/`'s client setup (starting Story 1.2) should add an explicit check there too.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-project-scaffold-from-starter-template.md`
  summary: No automated, repeatable test asserts the missing-`DATABASE_URL` fail-fast behavior — it was verified once manually this pass.
  evidence: Verification Gap review confirmed no test runner, test files, or CI step exercises this path, so a future change that silently swallowed the error (e.g. a hardcoded fallback URL) would merge undetected. Ties to the test-tooling deferral above — revisit together once a test runner is chosen.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-add-team-member.md`, `_bmad-output/implementation-artifacts/spec-1-4-configure-shared-allocation-category-list.md`
  summary: Duplicate names are allowed with no warning — for Team Members (two people could both be added as "Sam") and now also for Allocation Categories (two categories could both be named "Dev").
  evidence: Blind Hunter and Edge Case Hunter reviews flagged this independently for both stories. Not in either frozen spec's scope, and not addressed in the PRD/Architecture Spine. Needs a PM/product decision on whether to block, warn, or explicitly allow duplicates — the case for uniqueness is arguably stronger for categories (a shared taxonomy) than for people's names, but treating them consistently until a decision is made.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-add-team-member.md`
  summary: `domain/allocation.ts`'s `addTeamMember` (the first piece of pure, framework-free business logic in the codebase) has no unit tests.
  evidence: Blind Hunter review flagged this; ties directly to the standing test-runner deferral logged above from Story 1.1. This function is the concrete first candidate once a runner is chosen — it's pure and trivially testable by design (that's the point of the hexagonal architecture).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-add-team-member.md`
  summary: Form validation errors aren't associated with specific fields (no `aria-invalid`/`aria-describedby`) — one generic error message for the whole form.
  evidence: Blind Hunter review flagged this. Low priority with only one validation rule (name required) today, but revisit once `workingHoursPerDay` validation is added (this same story's patch pass) — at that point two distinct field errors could exist simultaneously and users will need to know which field is wrong.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-remove-team-member.md`
  summary: No audit trail for who removed a Team Member — `archivedAt` is set, but there's no `archivedBy`/actor reference.
  evidence: Blind Hunter review flagged this. Not required by the PRD or Architecture Spine (neither mentions an actor/audit field), so this is a product decision, not a defect — revisit if audit history ever becomes a real requirement.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-remove-team-member.md`
  summary: No `loading.tsx`/Suspense fallback for the `(pm)/roster` route segment while `list()` resolves.
  evidence: Blind Hunter review flagged this. Minor polish; the query is fast against a tiny table at this project's scale, so no visible impact yet.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-remove-team-member.md`
  summary: Team Member `id` is only checked for being a non-empty string in `removeTeamMemberAction`, not validated against the actual id format (cuid).
  evidence: Edge Case Hunter / Blind Hunter review flagged this. Low risk today since a malformed id would just fail the Prisma update and surface as the already-sanitized generic error message (per Story 1.2's patch), not a crash or leak — revisit if this ever becomes a real problem.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-remove-team-member.md`
  summary: The add-team-member client form's `maxLength`/numeric constraints aren't confirmed to mirror the domain layer's `MAX_NAME_LENGTH`/`MAX_WORKING_HOURS_PER_DAY` limits.
  evidence: Blind Hunter review flagged this. The server-side validation is already authoritative and correct (Story 1.2), so this is purely a UX nicety (avoiding an unnecessary round trip for a violation the user could have been warned about client-side first).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-configure-shared-allocation-category-list.md`
  summary: No `createdAt`/`updatedAt` audit timestamps on `AllocationCategory` (same open question already logged for Team Member's missing `archivedBy`).
  evidence: Blind Hunter review flagged this. Not required by any current spec/PRD/Architecture Spine — revisit together with the Team Member audit-trail question if audit history ever becomes a real requirement.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-configure-shared-allocation-category-list.md`
  summary: Brief UI "flash" back to a stale name/lingering error message during the gap between a successful rename/remove and `revalidatePath` completing.
  evidence: Blind Hunter and Edge Case Hunter both flagged variants of this. Matches a general limitation of this app's non-optimistic-UI pattern (relies on `revalidatePath`, not local optimistic state) — low severity, not worth the added complexity for an internal tool at this scale; revisit if it turns out to be genuinely annoying in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-assign-allocation-per-team-member.md`
  summary: No optimistic-concurrency protection on `TeamMemberAllocation` saves — two browser tabs saving the same Team Member's allocations race, last write silently wins.
  evidence: Blind Hunter and Edge Case Hunter both flagged this. Same judgment call already made for Story 1.4's UI-flash deferral: low severity, not worth a version/updatedAt column and conflict-detection UI for an internal single-PM tool at this scale; revisit if it becomes a real problem.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-assign-allocation-per-team-member.md`
  summary: `setTeamMemberAllocations` doesn't block allocating time to an archived Team Member at the domain layer — only unreachable today because the Roster page already excludes archived members from the list it renders.
  evidence: Edge Case Hunter flagged this. Defense-in-depth gap only, not exposed by any current UI path; revisit if a future caller (e.g. a bulk-import or API surface) can reach this function for an archived id.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-assign-allocation-per-team-member.md`
  summary: `domain/allocation.selfcheck.ts` has no CI/script wiring to run it automatically — it can silently rot.
  evidence: Blind Hunter flagged this. Ties directly to the standing no-CI-workflow deferral logged from Story 1.1 — same decision, now also applying to this new self-check file; revisit together once story cadence justifies adding CI.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-edit-allocation-and-working-hours.md`
  summary: The Team Member Detail Panel's combined Save (Allocation % + Working Hours) isn't atomic — it's two independent Server Action writes via `Promise.all`, so a mid-flight failure or crash between them can leave the two out of sync, and a `Promise.all` rejection can mask a write that actually already committed.
  evidence: Blind Hunter flagged both the non-atomicity and the swallowed-partial-write risk. A real cross-aggregate transaction would mean either bridging `TeamMemberRepo` and `TeamMemberAllocationRepo` writes in one transaction or an outbox/saga — disproportionate for an internal single-PM tool where a retry (reopening the panel) recovers cleanly; revisit if partial-save reports become a real problem.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-edit-allocation-and-working-hours.md`
  summary: No full UI/browser walkthrough has verified the panel's partial-failure behavior (dialog stays open on one action failing, correct error precedence) — Playwright MCP tooling was unreachable this session, so verification fell back to a real-Postgres infra-level script that bypasses the Server Actions and UI entirely for this path.
  evidence: Verification Gap review confirmed no test, self-check, or this pass's real-DB script exercises `team-member-detail-panel.tsx`'s `handleSave`/dialog-close logic — a regression there (e.g. closing on partial failure) would ship undetected. Revisit once Playwright tooling is reachable again; the manual steps are already specified in the spec's own Verification section.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-create-a-sprint.md`
  summary: `Sprint` has no `createdAt`/`updatedAt` audit timestamps.
  evidence: Blind Hunter flagged this. Same open question already logged twice for `TeamMember`/`AllocationCategory` — not required by any current spec/PRD/Architecture Spine; revisit together if audit history ever becomes a real requirement.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-create-a-sprint.md`
  summary: No `loading.tsx` for the `/sprint` route.
  evidence: Blind Hunter flagged this. Same standing deferral already logged for `/roster` in Story 1.3 — now also applies to this second route; revisit together.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-create-a-sprint.md`
  summary: The AD-6 partial unique index (`Sprint_one_active_idx`) exists only as hand-written migration SQL with no representation in `schema.prisma` — Prisma's schema DSL has no partial/filtered `@@unique` syntax. A future `prisma migrate dev` touching the `Sprint` model could schema-diff against declared state and generate a migration that silently drops this index, since Prisma doesn't know it exists.
  evidence: Blind Hunter and Edge Case Hunter both flagged this independently. No tooling fix is cheap here (Prisma has no way to declare a partial index); accepted risk for now given how rarely the `Sprint` model is expected to change — revisit (e.g. add a post-migration verification script) if a future schema change to `Sprint` actually triggers this.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-record-planned-leave.md`
  summary: `Leave` has no `createdAt`/`updatedAt` audit timestamps.
  evidence: Blind Hunter flagged this. Same open question already logged for `TeamMember`/`AllocationCategory`/`Sprint` — not required by any current spec/PRD/Architecture Spine; revisit together if audit history ever becomes a real requirement.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-record-planned-leave.md`
  summary: `recordLeave` doesn't block logging leave against an archived Team Member — only unreachable today because the Roster page already excludes archived members from the list it renders (same class of gap already logged for Story 1.5's `setTeamMemberAllocations`).
  evidence: Blind Hunter flagged this. Defense-in-depth gap only, not exposed by any current UI path; revisit together with the Story 1.5 entry if a future caller can reach either function for an archived id.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-record-planned-leave.md`
  summary: If the outer Team Member Detail Panel is closed (Escape/outside-click) while the Leave Entry popover's save is still in flight, the write completes server-side but the client-side success feedback (popover close, `onSaved`) is lost — the user may not know whether it saved and could resubmit, creating a duplicate entry (no overlap/duplicate check exists to catch that).
  evidence: Edge Case Hunter flagged this. Requires cross-component pending-state coordination (outer Dialog needs to know about the inner Popover's in-flight save) for a narrow, low-frequency interaction in a single-PM tool; accepted for now — revisit if duplicate leave entries turn out to be a real problem in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-record-planned-leave.md`
  summary: No UI/browser walkthrough has verified the "Log Leave" popover flow at all (form submission, popover close on success, error display) — no test, self-check, or real-DB script exercises the React components themselves, only the domain function and Server Action directly.
  evidence: Verification Gap review confirmed this is the one surface in this story with zero verification of any kind. Same standing gap already logged for Stories 1.6/1.7 — Playwright MCP tooling has been unreachable all session; revisit once it's reachable again.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-record-emergency-leave.md`
  summary: The Leave Entry form's Save button is `type="button"` with no wrapping `<form>`/`onSubmit`, so the `required` attribute on both date inputs is inert — native browser constraint validation never fires, and there's no client-side pre-check before the Server Action call either.
  evidence: Blind Hunter flagged this during the Story 2.2 one-shot review. Pre-existing from Story 2.1 (unchanged by 2.2's diff, which only added the Planned/Emergency toggle) — revisit if empty-submission round-trips to the server turn out to be annoying in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-record-holiday-office-closure.md`
  summary: `Holiday` has no `createdAt`/`updatedAt` audit timestamps.
  evidence: Blind Hunter flagged this. Same open question already logged for `TeamMember`/`AllocationCategory`/`Sprint`/`Leave` — not required by any current spec/PRD/Architecture Spine; revisit together if audit history ever becomes a real requirement.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-record-holiday-office-closure.md`
  summary: `domain/holiday.selfcheck.ts` has no CI/script wiring to run it automatically — it can silently rot.
  evidence: Blind Hunter flagged this. Ties directly to the standing no-CI-workflow deferral logged from Story 1.1, now applying to a 4th self-check file; revisit together once story cadence justifies adding CI.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-record-holiday-office-closure.md`
  summary: No interactive browser click-through has verified `AddHolidayForm`'s actual `onSubmit` wiring (argument order, `preventDefault`, success/error state transitions) — the real-DB check this pass called `recordHolidayAction` directly through a temporary API route, bypassing the component entirely.
  evidence: Verification Gap review confirmed this. Same standing gap already logged for Stories 1.6/1.7/2.1 — Playwright MCP tooling has been unreachable all session; revisit once it's reachable again.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-compute-sprint-capacity-per-person-and-team-total.md`
  summary: Marking an `AllocationCategory` as "Dev" (schema `isDev` flag, `setDev`/`unsetDev` domain fns/repo methods, Server Actions, and the Roster category row's toggle UI) was carved out of Story 2.5 as its own independently-shippable deliverable — a category-management enhancement, reviewable on its own, distinct from the Capacity math that consumes it.
  evidence: Story 2.5's draft spec was ~1900-2200 tokens (over the 900-1600 target) because it bundled two separately-mergeable PRs: the Dev-flag mechanism (Epic 1-flavored, no Capacity dependency) and the Capacity computation/display (which merely reads `isDev`, doesn't need to build the way to set it). User chose to split rather than keep the combined spec. Implemented immediately afterward as a one-shot (spec-mark-allocation-category-as-dev.md), so this entry documents the split decision rather than tracking outstanding work.

- source_spec: `_bmad-output/implementation-artifacts/spec-mark-allocation-category-as-dev.md`
  summary: The "Mark as Dev" toggle has no cross-row pending-state coordination — clicking it on two different Allocation Category rows in quick succession can fire two concurrent `setDev`/`unsetDev` Server Action calls; a genuine race would also surface as a generic "Failed to mark category as Dev" error rather than a distinguishable one, since `allocation-category-repository.ts`'s `setDev` only special-cases the not-found (`P2025`) Prisma error, not a concurrent unique-constraint hit (`P2002`).
  evidence: Blind Hunter review flagged this during the one-shot pass. The partial unique index keeps the data correct regardless; this is a UI/observability nicety only, low severity for a single-PM internal tool — same class of accepted risk already logged for Story 1.5's allocation-save race. Revisit if double-click races or unexplained 500s around this action turn out to be a real problem.

- source_spec: `_bmad-output/implementation-artifacts/spec-mark-allocation-category-as-dev.md`
  summary: No way to create a new Allocation Category and mark it Dev in a single step — `AllocationCategoryRepo.create` takes no `isDev` input, so setting up the first-ever Dev category always requires two round trips (add, then a separate "Mark as Dev" click).
  evidence: Blind Hunter review flagged this. Minor first-run friction only; the two-step flow works correctly today and Story 2.5's "no Dev category" advisory state already covers the gap in between — revisit if onboarding a fresh install turns out to be annoying in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-compute-sprint-capacity-per-person-and-team-total.md`
  summary: `domain/capacity.ts`'s `computeTeamMemberCapacityHours`/`computeCapacityForTeam` and `domain/calendar.ts`'s `countWorkingDays`/`getDistinctWorkingDaysLost` have no defensive input validation (negative/out-of-range `devPercent` or `workingHoursPerDay`, a Sprint/Leave/Holiday range with `endDate` before `startDate`, or `null`/`undefined` leaves/holidays arrays at the call boundary).
  evidence: Blind Hunter and Edge Case Hunter both flagged variants of this independently. Unreachable via the only real caller today: `TeamMember.workingHoursPerDay` (1-24) and allocation `percent` (0-100) are validated at write time (Stories 1.2/1.5), and `Sprint`/`Leave`/`Holiday` date ranges are always `endDate >= startDate` by construction/validation (Stories 1.7/2.1/2.3) — same class of "defense-in-depth gap, not exposed by any current UI path" already logged for Story 1.5's `setTeamMemberAllocations` and Story 2.1's `recordLeave`. Revisit if a future caller (bulk import, API surface) can reach these functions with unvalidated data.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-compute-sprint-capacity-per-person-and-team-total.md`
  summary: The `CapacityLedger`'s shrinking bar has no way to tell the PM *why* Capacity dropped (0% Dev allocation vs. Leave vs. Holiday) — no tooltip, label, or click-through to the exact overlapping entries `TeamMemberDetailPanel`'s "Leave & Holidays" section (Story 2.4) already computes via `scopeEntriesToSprint`.
  evidence: Blind Hunter review flagged this. A real UX enhancement, but the interaction pattern (tooltip content, click-through target) needs design judgment beyond this story's scope — Story 2.5 only computes and displays the headline figure per its own Never clause. Revisit alongside Story 2.6's breakdown view, which will already have the per-category data this explanation would need.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-compute-sprint-capacity-per-person-and-team-total.md`
  summary: The `CapacityLedger`'s `size="small"` variant (used for every per-row instance) has implementer-invented pixel values (`h-1.5` track, `text-sm` headline) — DESIGN.md's `components.capacity-ledger` token block only specifies one 22px height/track, with no small-variant defined.
  evidence: Blind Hunter review flagged this. Not a functional defect and not a deviation from an explicit spec value (none exists yet); a design-fidelity nit worth a UX sign-off if the visual weight of the per-row ledger ever matters, but not worth blocking this story on.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-view-allocated-hours-breakdown.md`
  summary: `app/(pm)/roster/page.tsx` fetches `teamMembers`/`allocationCategories`/`activeSprint`/`holidays` in one `Promise.all`, then a second `Promise.all` fetches allocation/leave rows keyed by the first batch's member ids — a Team Member added or removed in the narrow window between the two batches would leave the second batch's data keyed against a now-stale member-id set.
  evidence: Edge Case Hunter flagged this during Story 2.6's review (pre-existing pattern since Story 2.4 introduced the two-batch fetch, not caused by 2.6's diff, which only adds more computation after both batches complete). Same class of accepted risk already logged for Story 1.5's allocation-save race — an extremely narrow window, low severity for a single-PM internal tool with human-paced usage; revisit if it ever causes an observed data mismatch.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-view-allocated-hours-breakdown.md`
  summary: The `<details>/<summary>` breakdown disclosure uses only the project's baseline `cursor-pointer` styling with no deeper tie-in to DESIGN.md's glass/accent visual system (custom marker color, hover state, etc.) used everywhere else in this component and page.
  evidence: Blind Hunter review flagged this. Functionally correct and accessible (native disclosure semantics), but a visual-fidelity nit — same class of judgment call already logged for Story 2.5's `size="small"` variant; revisit alongside it if UX signs off on a fuller `<details>` treatment.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-view-allocated-hours-breakdown.md`
  summary: The breakdown list has no visual indicator showing which category is "Dev" (the one driving the headline bar's `accent-peach` fill) — a PM has to already know which category name is the Dev one to connect the shrinking bar to its matching row in the disclosed list.
  evidence: Blind Hunter review flagged this. A real UX enhancement needing design judgment (e.g. a badge or highlight on that row), not a mechanical fix — same class as Story 2.5's already-deferred "no tooltip explaining why Capacity dropped," which this would naturally extend.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-connect-to-youtrack.md`
  summary: `infrastructure/youtrack/client.ts`'s connection tester has never been exercised against a real, reachable YouTrack MCP server — no such server exists in this environment. The happy-path (valid credentials, real project) and the `UnauthorizedError` (401/expired-token) translation branch are both implemented against the real, installed `@modelcontextprotocol/client` SDK's actual API (verified by reading its type definitions directly) but structurally unverified end-to-end.
  evidence: Disclosed to the human before this story was built (they chose "build it, verify what I can" over waiting for a real server or skipping the epic). Everything reachable without a live server was verified: validation, the "nothing persists on failure" guarantee, and a real network failure's error-translation path (a genuinely unreachable hostname). Revisit as the first thing to check once a real YouTrack MCP server is connected to this project — before trusting Story 3.2+'s backlog browsing.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-connect-to-youtrack.md`
  summary: `youTrackConnectionTester.test()` verifies the server is reachable and the token is accepted, but never verifies `projectId` actually exists on the connected instance — a typo'd or inaccessible project id saves successfully and only surfaces as broken once Story 3.2's backlog browsing tries to use it.
  evidence: Edge Case Hunter and Blind Hunter both flagged this. Verifying a project id requires calling a specific YouTrack MCP tool with a specific schema, which isn't designed yet (that's Story 3.2's job) — adding a guess at that contract now risks building against the wrong shape. Revisit as part of Story 3.2's browse-tool design, where the real tool contract will exist to check against.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-connect-to-youtrack.md`
  summary: There is no way to disconnect or clear a saved YouTrack connection — `YouTrackConfigRepo` only has `get`/`save`, and the Settings UI has no "remove connection" action. Once configured, a connection can only be overwritten, never cleared.
  evidence: Blind Hunter flagged this. Not required by any AC in this story (which only asks to configure and validate a connection) — a real, legitimate future enhancement, not a defect; revisit if a PM ever needs to fully disconnect (e.g. before decommissioning a YouTrack instance).

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-connect-to-youtrack.md`
  summary: `youTrackConnectionTester`'s non-401 failure branch collapses DNS failure, a 403 (valid token, no project access), and "reached a server that isn't a YouTrack MCP endpoint at all" into one generic "Could not reach the YouTrack server" message.
  evidence: Blind Hunter flagged this. Distinguishing these reliably needs real-server-validated knowledge of the SDK's specific error types/status codes for each case, which can't be gathered without a live YouTrack MCP server to test against (same root constraint already disclosed for this story) — the underlying error is now logged server-side (this pass's patch) so the real cause isn't lost, even though the user-facing message stays generic for now.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-connect-to-youtrack.md`
  summary: Once a YouTrack connection is saved, `/settings` displays "Currently connected: …" purely from stored config with no ongoing re-verification — if the token is later revoked or expires on the YouTrack side, the UI keeps claiming a healthy connection indefinitely.
  evidence: Blind Hunter flagged this. A real UX gap, but a periodic or on-demand health-check is new scope beyond "configure and validate at save time" (this story's actual AC) — revisit once real usage reveals staleness is a practical problem, likely alongside Story 3.2's browse-time error handling.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-connect-to-youtrack.md`
  summary: No UI/browser walkthrough has verified `saveYouTrackConfigAction`'s own `FormData`-extraction, try/catch, and `revalidatePath` wiring — only the pure `saveYouTrackConfig` domain function was exercised (via self-check and a temporary API route bypassing the Server Action entirely).
  evidence: Verification Gap review confirmed this. Same standing gap already logged for Stories 1.6/1.7/2.1/2.3 — Playwright MCP tooling has been unreachable all session; revisit once it's reachable again.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-browse-youtrack-backlog-issues.md`
  summary: RESOLVED for `search_issues` (2026-08-20, real production incident): a live YouTrack MCP server's actual `search_issues` response was captured and diverged from the original guesses in two ways, both now fixed — (1) the issue array is keyed `issuesPage`, not `issues` (kept as a fallback candidate); (2) `customFields` is a flat `{fieldName: value}` object (e.g. `{"Type":"Task","Assignee":"jyothish.s"}`), not a `{name,value}[]` array (also kept as a fallback candidate, in case a different tool/version uses it). `extractIssueList`/`findCustomField` now handle both shapes, verified against a reconstruction of the exact real payload plus updated self-check assertions using the real field names/values. `get_issue`'s own response shape (used for enrichment — assignee/priority/estimate) is a **separate, still-unconfirmed** tool call; the `customFields`-shape fix should carry over if get_issue uses the same convention, but this hasn't been directly observed.
  evidence: Real production failure, not a review finding — a user's live YouTrack server rejected the app's actual search_issues call, and the raw response was captured via added diagnostic logging (`extractToolErrorText`, and logging the raw result on an unrecognized shape) and fed back for a targeted fix + verification. Revisit `get_issue`'s shape specifically (assignee/priority/estimate/logged-hours enrichment) the next time Browse Backlog or Close Sprint is used against this same real server — those values may still come back blank if get_issue's shape differs further.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-connect-to-youtrack.md`
  summary: RESOLVED (2026-08-20, real production incident): `SEARCH_LIMIT` was set to 50, but a live YouTrack MCP server enforces a real, confirmed maximum of 20 (`search_issues` rejected `limit:50` with `isError:true`, text: "Argument 'limit' exceeds maximum 20.0: 50.0") — every search request was failing outright. Fixed to 20. Separately, `youTrackConnectionTester.test()` only ever called `ping`, which doesn't prove a token works for real operations (this exact gap is what let a broken connection save successfully in Settings) — it now also performs a real `search_issues` call and checks for `isError`, catching a bad-permissions token or wrong Project ID at save time instead of confusingly later.
  evidence: Real production failure. The user's connection saved successfully (ping passed) but Browse Backlog failed with `UnauthorizedError`; per the MCP SDK's own docs, any 401 throws immediately since this app's `AuthProvider` doesn't implement `onUnauthorized`. Once the token/permissions issue was resolved on the user's end and the connection test strengthened, the next real failure (the limit:50 rejection) surfaced with full diagnostic text thanks to the new `extractToolErrorText` logging, and was fixed directly. No further action needed unless a different server's real limit turns out to be lower than 20 too.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-browse-youtrack-backlog-issues.md`
  summary: No real-browser walkthrough has verified the Backlog Drawer's actual client-side behavior (opening the Sheet, the loading/not-configured/error/loaded state transitions, or that `listBacklogIssuesAction` is wired correctly to the trigger) — a `msedge.exe --headless=new --dump-dom` attempt (the technique that worked for Story 2.4's simpler static Dialog) did not succeed for this async-fetching component after several attempts with increasing virtual-time budgets.
  evidence: Same standing gap already logged for Stories 1.6/1.7/2.1/2.2/2.3/3.1 — Playwright MCP tooling has been unreachable all session. The headless-Edge fallback that substituted for it in Story 2.4 didn't reproduce here, root cause not conclusively identified (not worth further time this pass); the real-DB check covers the data-layer wiring (`listBacklogIssues` against the real repo), but the actual rendered UI states remain unverified by eye.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-browse-youtrack-backlog-issues.md`
  summary: `extractFieldName` only handles a single-value assignee (a string, or an object with `name`/`fullName`/`login`) — if YouTrack's real response represents a multi-assignee field as an array, it returns `null` and an assigned issue displays as "Unassigned."
  evidence: Blind Hunter and Edge Case Hunter both flagged this. Whether YouTrack's real MCP response ever represents assignee as an array can't be confirmed without a live server (same root constraint as this story's main disclosed gap) — revisit alongside the other real-server-dependent parsing questions once one is connected.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-browse-youtrack-backlog-issues.md`
  summary: `findCustomField` takes the first `customFields` entry matching a candidate name; if a project's field scheme has two fields whose names both match the same candidate list (e.g. two fields both containing "estimate"), the wrong one could silently win with no indication of ambiguity.
  evidence: Edge Case Hunter flagged this. Very low practical likelihood (a real YouTrack field scheme wouldn't typically have two same-purpose fields with colliding names) and unverifiable without real project field-scheme data; accepted as-is, revisit if it ever produces a visibly wrong value in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-browse-youtrack-backlog-issues.md`
  summary: `enrichWithCustomFields` calls `get_issue` with `issueId: issue.id`, where `issue.id` is `search_issues`'s `idReadable` (preferred) or internal `id` — if `get_issue`'s real, documented parameter actually expects the other one specifically, every enrichment call would fail (silently, since a per-issue enrichment failure renders blank fields rather than an error).
  evidence: Blind Hunter flagged this. JetBrains' docs don't specify which id shape `get_issue` expects — genuinely unknowable without a live server to test against, same root constraint as this story's main disclosed gap.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-browse-youtrack-backlog-issues.md`
  summary: `enrichWithCustomFields` is dispatched via `Promise.all` for up to `SEARCH_LIMIT` (50) issues with no concurrency cap — all `get_issue` calls fire simultaneously.
  evidence: Blind Hunter flagged this. Not expected to be a real problem at this app's scale (a single small team's backlog, capped at 50 issues, is well within any reasonable server's concurrent-request tolerance) — a per-call timeout was added this pass so a hang no longer blocks indefinitely; a concurrency cap would add real complexity for a risk that hasn't been observed. Revisit if a real backlog of this size proves slow or triggers rate-limiting.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pull-backlog-issues-into-a-sprint.md`
  summary: No interactive browser walkthrough has verified the Backlog Drawer's actual pull UI (checkbox selection, per-row estimate-field validation, the "Pull Selected" click flow, or the pulled-badge transition after a successful pull) — only the underlying domain/repo logic (`pullBacklogIssue`) was verified against a real database.
  evidence: Same standing gap already logged for Stories 1.6/1.7/2.1/2.2/2.3/3.1/3.2 — Playwright MCP tooling has been unreachable all session. The `msedge.exe --headless=new --dump-dom` fallback that worked for Story 2.4's simple static Dialog didn't reproduce for Story 3.2's async drawer; not re-attempted for this even more stateful (checkbox + per-row input + batch-submit) version of the same component. Revisit once real browser tooling is reachable again.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pull-backlog-issues-into-a-sprint.md`
  summary: `pullBacklogIssue` has no upper bound on `estimateHours` (only positivity/finiteness), and no max-length validation on `title`/`youtrackIssueId` — a typo like 99999 hours would persist without complaint, unlike `domain/youtrack.ts`'s length-capping precedent for other externally-sourced strings.
  evidence: Blind Hunter and Edge Case Hunter both flagged variants of this. Picking a sane upper bound is a product judgment call (what's a reasonable max estimate?), not a mechanical fix — low urgency for a trusted internal tool with one PM entering the data; revisit if a fat-fingered estimate ever visibly skews Capacity math.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pull-backlog-issues-into-a-sprint.md`
  summary: `app/(pm)/sprint/page.tsx` discards every field from `backlogIssueRepository.listForSprint()` except `youtrackIssueId` (used only for the drawer's pulled/not-pulled `Set`) — the persisted `estimateHours` (which may differ from YouTrack's own value if the PM overrode it) isn't available to show on the "Pulled" badge.
  evidence: Blind Hunter flagged this. No current UI shows a number on the "Pulled" badge at all, so nothing is actually lost yet — this anticipates a future enhancement rather than fixing an existing gap. Revisit if/when a "Pulled" badge is asked to show the persisted estimate.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pull-backlog-issues-into-a-sprint.md`
  summary: `BacklogDrawer`'s `pulledIds` state is seeded once from the `pulledYoutrackIssueIds` server prop and only ever grows via local optimistic updates after a successful pull in the same session — it's never re-fetched/re-synced when the drawer is reopened, so a pull made from a different session/tab in the meantime wouldn't show as "Pulled" without a full page reload.
  evidence: Blind Hunter and Edge Case Hunter both flagged this. Low real-world likelihood for this app's actual usage pattern (one PM, effectively one active session) — revisit if multi-tab/multi-session usage ever becomes real.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pull-backlog-issues-into-a-sprint.md`
  summary: No automated test exercises `infrastructure/db/backlog-issue-repository.ts`'s actual Prisma field mapping or its behavior on a foreign-key violation — only the pure `domain/backlog-issue.ts` logic has self-check coverage; the repository itself was verified this pass only via a one-off real-DB check (not a persistent, repeatable test).
  evidence: Blind Hunter flagged this. Same standing pattern already accepted for every other repository in this codebase (real-DB checks via temporary routes, not persistent infra-layer tests) — ties to the standing no-test-runner/no-CI deferral from Story 1.1.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pull-backlog-issues-into-a-sprint.md`
  summary: `BacklogDrawer` has no protection against overlapping/out-of-order requests (rapidly closing and reopening the drawer can leave a stale `listBacklogIssuesAction` response overwriting fresher state) and no client-side timeout on the "Pull Selected" batch (`Promise.all` over same-origin `pullBacklogIssueAction` calls, unlike the YouTrack-network calls in Stories 3.1/3.2 which do have timeouts).
  evidence: Edge Case Hunter flagged both. Low practical likelihood for a single-PM tool clicking through one drawer at a time, and the pull batch hits only this app's own database (not an external network), so a genuine indefinite hang is far less likely than the YouTrack-adapter cases already addressed. Revisit if either is ever observed in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-assign-issues-to-team-members-within-a-sprint.md`
  summary: No interactive browser walkthrough has verified the assignee `<select>` itself (pre-selection to the correct current assignee, the `onChange` round-trip, inline error display on a failed assignment) — only the underlying `assignBacklogIssue` domain/repo logic was verified against a real database.
  evidence: Same standing gap already logged for Stories 1.6/1.7/2.1/2.2/2.3/3.1/3.2/3.3 — Playwright MCP tooling has been unreachable all session. Revisit once real browser tooling is reachable again.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-assign-issues-to-team-members-within-a-sprint.md`
  summary: If a Team Member is archived after being assigned to a pulled issue, the assignee `<select>` (only populated from non-archived `teamMemberRepository.list()`) has no matching `<option>` for that id — the browser renders it as "Unassigned" even though the database still holds the archived member's id, misrepresenting the actual assignment state.
  evidence: Blind Hunter and Edge Case Hunter both flagged this. Fixing it requires deciding how an archived-but-still-assigned member should display (their name? a distinct "(archived)" label?) — a product/design judgment call, not a mechanical fix. Revisit if archiving a team member mid-Sprint with assigned issues turns out to be a real workflow.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-assign-issues-to-team-members-within-a-sprint.md`
  summary: The assignee `<select>` only appears for issues currently returned by the live YouTrack browse fetch (`state.issues`) — a pulled issue that YouTrack has since marked resolved, or that falls outside the 50-issue truncation window, has no row in the drawer at all, so its assignee becomes unviewable/unchangeable from this UI. No separate "all issues pulled into this Sprint" list exists anywhere yet.
  evidence: Blind Hunter flagged this. A real design gap, but the fix (a persistent pulled-issues list independent of the live backlog search) is a meaningfully bigger addition than a patch — it overlaps with Epic 4's Sprint Plan Overview, which is exactly the kind of "list assigned issues" surface FR22 describes. Revisit there rather than growing the Backlog Drawer further.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-assign-issues-to-team-members-within-a-sprint.md`
  summary: `BacklogDrawer`'s `pulledByYoutrackId` state is seeded once from the `pulledIssues` server prop and never re-synced on a later render (e.g. after another `revalidatePath('/sprint')`) — an assignment made from a different tab/session wouldn't be reflected without a full page reload.
  evidence: Same class of gap already logged for Story 3.3's `pulledIds`. Low real-world likelihood for this app's actual usage pattern (one PM, effectively one active session).

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-assign-issues-to-team-members-within-a-sprint.md`
  summary: No protection against two people reassigning the same issue at nearly the same time (last write silently wins, no conflict warning), and `assignBacklogIssue`'s active-Sprint pre-check has a narrower race window than `pullBacklogIssue`'s equivalent check — if the Sprint closes between `sprintRepo.findActive()` and the `updateMany`, the write still succeeds (there's no FK/CHECK constraint tying assignment specifically to Sprint-active-status, unlike `pullBacklogIssue`'s `P2003` backstop).
  evidence: Edge Case Hunter flagged both. Very low practical likelihood for a single-PM tool, and the race window is a handful of milliseconds; revisit if either is ever observed in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-over-allocation-warning.md`
  summary: If a Team Member is archived while still holding assigned `BacklogIssue` rows (archiving is a soft delete, `assigneeId` is only `SetNull` on a hard delete), their assigned hours still count toward the team-wide total but have no per-member visibility anywhere in the UI — `teamMemberRepository.list()` excludes archived members, so `allocationComparisonByMemberId` never gets an entry keyed by their id, and no display shows whose orphaned assignment is inflating the team figure.
  evidence: Edge Case Hunter flagged this. Not covered by the frozen I/O matrix (which only specifies per-member and team-wide comparisons for current, non-archived members), and the same class of gap already deferred for Story 3.4's archived-but-assigned `<select>` case — a product/design judgment call (show the archived member's name? reassign automatically?) rather than a mechanical fix. Revisit if archiving mid-Sprint with assigned issues turns out to be a real workflow.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-sprint-plan-overview.md`
  summary: On the Sprint Plan Overview, a `BacklogIssue` assigned to a Team Member who is later archived renders as "Unassigned" in the Assigned Backlog Issues list (`nameByMemberId` is built only from the non-archived `teamMembers` list), which is actively misleading — the issue does have an assignee, the display just can't distinguish that from a genuinely unassigned issue.
  evidence: Edge Case Hunter flagged this. This is the third occurrence of the identical archived-assignee root cause this epic (Story 3.4's `<select>` with no matching option, Story 3.5's invisible per-member orphaned hours, now this) — worth resolving as one consolidated product decision (e.g. a distinct "(archived)" label carrying the archived member's name through) rather than patching each surface separately. Revisit alongside the other two entries above.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-sprint-plan-overview.md`
  summary: The `NO_TEAM_MEMBERS` I/O-matrix scenario (Sprint Plan Overview's empty-roster copy) could not be exercised against the real database this pass — a real Team Member ("Akhil Narayanan") already exists in this environment, and removing/archiving a genuine user's own record to test an empty state would violate the standing constraint against touching real data in verification. The branch itself is a straight copy-paste of `/roster`'s identical, already-proven ternary (`teamMembers.length === 0 ? ... : ...`), so risk is low, but it has no direct evidence from this pass.
  evidence: Verification Gap flagged the missing coverage; the reason it stayed uncovered is a deliberate choice, not an oversight (see the standing no-real-records-in-test-scripts constraint). Revisit only if this environment's DB is ever seeded with zero real Team Members, or a proper test fixture/seed strategy is introduced.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-sprint-plan-overview.md`
  summary: `app/error.tsx`'s custom error boundary was never actually triggered during verification (only `tsc`/lint confirmed it type-checks and matches the existing per-route pattern) — no real render failure was forced to confirm the custom fallback appears instead of Next's default error overlay.
  evidence: Verification Gap flagged this. Closing it would require a temporary throw injected into `page.tsx` and reverted afterward, which risks leaving a stray change behind — lower value than the risk for a component this simple and this closely copied from `/roster/error.tsx`'s already-working pattern. Revisit if this exact error boundary is ever suspected of not firing in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-sprint-plan-overview.md`
  summary: The eleven new `revalidatePath("/")` calls added across `backlog-issues.ts`, `allocation-categories.ts`, `holiday.ts`, `leave.ts`, `sprint.ts`, `team-member-allocations.ts`, and `team-members.ts` were confirmed only via full HTTP curl requests, which re-render this dynamic Server Component fresh regardless of `revalidatePath` — the calls' actual effect on Next's client-side Router Cache (a `<Link>`-based soft navigation staying stale without them) was not directly observed.
  evidence: Same class of gap already logged for Story 3.5's identical `revalidatePath("/roster")` verification — curl cannot distinguish "revalidatePath worked" from "the route re-rendered fresh anyway." Revisit only if stale client-side navigation is ever observed in practice; the pattern itself matches every other cross-page revalidation already established and working in this codebase.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-close-a-sprint-and-confirm-actual-velocity.md`
  summary: `confirmSprintCloseAction`'s re-validation drops any confirmed-hours entry that isn't a currently-assigned issue in the Sprint (fixing the cross-Sprint/stale-preview bug review found), but an issue that gets newly *assigned* to the Sprint after the Close Sprint dialog's preview loaded and before the PM confirms is simply absent from both the write and the Actual Velocity sum — it silently keeps its prior `loggedHours`/`loggedHoursPulledAt` (usually null/0, "not yet checked") forever once the Sprint closes, since there's no reopen path.
  evidence: A narrower remainder of the bug Edge Case Hunter, Verification Gap, and Blind Hunter all independently found; the security/correctness-critical half (cross-Sprint writes, forged issue ids inflating Actual Velocity) is fixed. This remaining piece is a preview-staleness race requiring either a live lock or a "re-validate immediately before commit and force a fresh preview if the assigned-issue set changed" step — same class of gap already deferred for Story 3.3/3.4's `pulledIds`/`pulledByYoutrackId` never re-syncing on reopen. Low real-world likelihood for this app's single-PM usage pattern; revisit if multi-tab/concurrent Sprint editing ever becomes real.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-close-a-sprint-and-confirm-actual-velocity.md`
  summary: `confirmSprintCloseAction` stores `snapshotAllocationBreakdown: []` (and `snapshotCapacityHours: 0`) identically for two different real states — "no Dev category was ever configured, so Capacity doesn't apply" vs. "a Dev category exists but genuinely computes to zero/empty" — with nothing in the stored snapshot to distinguish them after the fact.
  evidence: Edge Case Hunter flagged this. The live pages (Roster, Sprint Plan Overview) already have this same ambiguity resolved via a runtime `!devCategory` check against the *current* `AllocationCategory` list, but a closed Sprint's snapshot has no equivalent flag frozen alongside it. Not fixed now because resolving it means deciding Story 4.3's (Velocity History) own display contract for this case — a product/design decision for that story, not a mechanical patch here. Revisit when building 4.3.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-close-a-sprint-and-confirm-actual-velocity.md`
  summary: No live YouTrack server exists in this environment (the standing constraint carried from Epic 3) — `getLoggedHours`'s actual behavior against a real instance, and whether "spent time"/"time spent"/"logged time" are YouTrack's real custom-field name(s) for logged time tracking, could not be verified. Also, no real-browser/screenshot check of `close-sprint-dialog.tsx`'s rendered UI (the "0h logged" vs "Not yet checked" visual distinction, the running total updating live, Dialog focus-trap behavior) was done — only the underlying Server Actions were exercised via curl/synthetic fixtures; Playwright/browser automation has been unreachable all session.
  evidence: Same standing gaps already logged repeatedly since Epic 3 (real YouTrack server, real browser automation both unreachable in this environment). Revisit once either becomes reachable.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-3-velocity-history-and-trend.md`
  summary: `app/(pm)/velocity-history/page.tsx` reads `sprint.snapshotActualVelocityHours ?? 0`, silently rendering "0.0h" for both "genuinely zero Actual Velocity" and "never actually recorded" (the column is nullable at the schema level, with no `NOT NULL` or CHECK constraint tying it to `status: 'closed'`). Today's only code path that closes a Sprint (`sprintRepository.close`) always writes a real number, so this can't currently occur through any in-app action — but nothing in the schema enforces that, so a future seed script, admin/DB fix, or migration backfill default could produce a closed Sprint with this field genuinely null and have it silently misread as a real zero.
  evidence: Edge Case Hunter flagged this. Not fixed now because there's no reachable path through this app's own UI/actions that produces the null state to guard against — adding a distinct "not recorded" display would be speculative defense against an input the app itself never generates. Revisit if a seeding/backfill/admin-tool path is ever added that could close a Sprint outside `sprintRepository.close`.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-4-shared-read-only-team-view.md`
  summary: `app/share/[token]/page.tsx`'s "read live on every request, never cached" claim was verified only under `next dev` (no caching by default) — a `next build && next start` smoke check of this one dynamic route (confirming Next doesn't statically-optimize a page with no explicit `dynamic` export, direct Prisma reads, and a dynamic `[token]` segment) was never run.
  evidence: Verification Gap flagged this. Consistent with this whole session's established verification approach (dev-server + real-DB checks, never a full production build) — a production build introduces its own separate risk surface and wasn't in scope for any prior story either. Revisit before an actual production deployment of this app.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-4-shared-read-only-team-view.md`
  summary: The `NO_TEAM_MEMBERS` empty-roster fallback ("No team members yet…") could not be exercised on `/share/[token]` for the same reason already logged for Story 4.1 — a real Team Member ("Akhil Narayanan") exists in this environment and archiving/removing them to test the empty state would violate the standing no-real-data-in-tests constraint. Since this route now shares `components/sprint-plan-content.tsx` with `app/page.tsx`, the branch itself is the identical, already-covered-by-inspection code path — no new risk from the extraction, just no fresh evidence.
  evidence: Same reasoning and same standing constraint as the Story 4.1 entry above; not re-logged as a distinct risk, just noted for completeness since this route is a new consumer of the same shared branch.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-connect-a-youtrack-mcp-server.md`
  summary: `infrastructure/youtrack-mcp/client.ts`'s `youTrackMcpConnectionTester`/`getReadOnlyToolRegistry` were verified only against fakes (`domain/youtrack-mcp.selfcheck.ts`) and by reading the installed `@modelcontextprotocol/client` v2 SDK's real type definitions directly — never against a real, reachable YouTrack MCP server this pass. The tool-list itself (the 23-tool/13-read split baked into the allowlist) *was* live-verified against `https://admarentech.myjetbrains.com/mcp` per the spec's Design Notes, but that verification happened outside this implementation pass; this pass didn't repeat it, and didn't exercise `find_projects`'s actual response shape live either. `findsProject()`'s heuristic (JSON-array-length, else a case-insensitive substring check over any text content) is a best-effort guess at an undocumented shape, same class of "genuinely unknowable without a live call" gap already logged repeatedly for Story 3.1/3.2's REST/MCP predecessors.
  evidence: The existing `YouTrackConfig` row (Story 3.1, pre-REST-migration) reportedly still holds working MCP credentials for this instance, but this pass deliberately did not drive a real network call through it — the standing constraint against using the user's own real data/credentials in verification scripts (see MEMORY.md) applies here too, not just to DB rows. Verification instead used: the two required self-checks (fakes only), `npx tsc --noEmit` against the SDK's real installed types, `npm run lint`, and a real-DB round-trip of `youTrackMcpConfigRepository` (via a temporary Next.js route, deleted after use) with synthetic fixture values confirming the singleton-upsert/select-shape and that `/settings`'s rendered HTML never leaks the token. Revisit `findsProject()` and the tester's happy/BAD_PROJECT paths the first time this connection is actually saved against a real server with a real Project ID.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-connect-a-youtrack-mcp-server.md`
  summary: Neither YouTrack connection form (`serverUrl` on the new `YouTrackMcpConfig`, `instanceUrl` on the pre-existing `YouTrackConfig`) guards against an SSRF target — only the `http:`/`https:` scheme is checked, so a PM-supplied URL pointing at localhost, a link-local/metadata address, or other internal infrastructure would still pass validation and be used for real outbound connect/tool-call traffic.
  evidence: Edge Case Hunter and Blind Hunter reviews both flagged this independently for the new MCP connection; it is not a new gap this story introduced — `domain/youtrack.ts`'s existing REST config (Story 3.1) has the identical scheme-only check with no host-range guard. A single shared fix (e.g. a host-allowlist/denylist helper both `saveYouTrackConfig` and `saveYouTrackMcpConfig` call) would address both call sites at once rather than patching one in isolation.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-connect-a-youtrack-mcp-server.md`
  summary: `authToken` is stored in plaintext in both `YouTrackMcpConfig` and the pre-existing `YouTrackConfig` — no field-level encryption or KMS-backed secret store, despite being a live credential with server-side network reach into an external system.
  evidence: Blind Hunter review flagged this for the new table; it is a pre-existing, already-shipped pattern from Story 3.1's `YouTrackConfig`, replicated here for consistency rather than introduced fresh. Worth a deliberate PM/architecture decision (accept as-is for an internal single-team tool vs. add encryption-at-rest) rather than an incidental per-story fix.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-connect-a-youtrack-mcp-server.md`
  summary: Both YouTrack adapters' unexpected-error branches (`infrastructure/youtrack-mcp/client.ts` and the pre-existing `infrastructure/youtrack/client.ts`) `console.error` the raw caught error object with no redaction, which could surface sensitive detail (e.g. auth-header content on an SDK-thrown HTTP error) in server logs.
  evidence: Blind Hunter review flagged this for the new MCP adapter; the existing REST adapter logs its unexpected-error branch the identical way, so this is a systemic logging-hygiene gap across both YouTrack integrations, not unique to this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-connect-a-youtrack-mcp-server.md`
  summary: Both singleton config repositories (`youTrackMcpConfigRepository` and the pre-existing `youTrackConfigRepository`) rely solely on always targeting a fixed `"singleton"` id for their "at most one row" invariant — two concurrent `save()` calls racing the same `upsert`'s `create` branch could hit a duplicate-key error with no retry/catch.
  evidence: Edge Case Hunter review flagged this for the new repository; the existing REST config repository (Story 3.1) has the identical upsert-on-fixed-id shape and the same theoretical race, so this is a pattern-level gap replicated by design, not a defect unique to this story's code.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-ask-the-assistant-about-youtrack-data.md`
  summary: Story 5.2 ships standard tool-calling grounding (the model sees a real tool's JSON result and narrates it in its own words) instead of AD-8's stricter letter — "every number or fact... substituted in by app code from that call's actual return value, never typed by the model itself" — which would require a synthetic terminal-tool contract (e.g. `present_answer` with `[[n]]`-placeholder citations the app resolves and substitutes, `cannot_answer` as the only other valid turn-ending call) so no code path lets the model's free text reach the user unmediated.
  evidence: Human decision this session, made explicitly aware of the tradeoff: the full citation-substitution design was drafted and scoped (~2550 tokens, exceeding the spec token target), and the human chose to split it off rather than accept the larger spec now. The residual risk is real but bounded — a real tool is always called before any figure is stated, so the hallucination risk AD-8 most cares about (answering with zero grounding) is closed; what remains open is the model mistyping/garbling a number it did see. Revisit if this Query Assistant sees real usage and mistranscription turns out to matter, or before Story 5.3 extends grounding to blended YouTrack + app-domain figures where an attribution mistake is more consequential.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-ask-the-assistant-about-youtrack-data.md`
  summary: `app/api/assistant/route.ts` sends the client's entire resent conversation transcript to Groq on every turn with no cap on message count or per-message length, and re-fetches the full YouTrack MCP tool registry (a live network round trip) on every single POST rather than caching it.
  evidence: Blind Hunter review flagged both independently. Low real risk today (single trusted PM user, free-tier low-volume usage per the architecture's own assumption), but a runaway client loop or a long conversation could grow cost/latency unbounded, and re-fetching the tool registry every turn adds avoidable MCP round-trip latency to every message. Revisit if usage grows or latency becomes noticeable.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-ask-the-assistant-about-youtrack-data.md`
  summary: A tool call's raw result is sent to both the model's context and the chat UI's source list as an untruncated `JSON.stringify(result.result)` — a large `search_issues`/`get_issue_comments` result could produce an unreadably long source line or push toward the model's context limit.
  evidence: Blind Hunter review flagged this. Not yet a real problem (`openai/gpt-oss-120b`'s context window and typical YouTrack result sizes leave headroom), but no truncation/summarization exists as a backstop. Revisit if a real query against a large project surfaces this.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-ask-the-assistant-about-youtrack-data.md`
  summary: The assistant route's timeout race (`Promise.race([iterator.next(), deadline])`) abandons the in-flight Groq/MCP call on timeout rather than actually cancelling it — the real network request keeps running server-side after the response has already closed, wasting quota/load on a timed-out turn.
  evidence: Blind Hunter and Edge Case Hunter reviews both flagged this. True cancellation would require threading an `AbortSignal` through both `groq-sdk`'s request options and `callAllowedTool`'s MCP calls — a real change, not a one-line fix. The immediate unhandled-rejection risk from the abandoned promise itself was patched this pass; the underlying "still running after we've moved on" waste remains. Revisit if Groq free-tier rate limits or MCP server load become a practical problem.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-ask-the-assistant-about-youtrack-data.md`
  summary: The chat input has no visible or `aria-`-associated label (placeholder-only), and the streaming message list has no `aria-live` region announcing incoming assistant text; the message list also doesn't auto-scroll to the latest message.
  evidence: Blind Hunter review flagged all three. The existing YouTrack/settings forms in this codebase do provide visible `<span>` labels for their inputs, so the chat input is a minor regression from that established convention. Cosmetic/accessibility polish, not a functional blocker for an internal single-user tool's v1.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-ask-the-assistant-about-youtrack-data.md`
  summary: The client-resent conversation history accepts a `role: "assistant"` entry at face value with no way to verify it's a faithful record of what the server actually said — a tampered or hand-crafted request could inject fabricated prior "assistant" turns to bias the model's next answer.
  evidence: Edge Case Hunter review flagged this. Inherent to the spec's own deliberate no-server-side-persistence design (client is the sole holder of history); the only realistic actor able to exploit it is the PM manipulating their own tool, which has no real consequence under this app's single-user threat model. Revisit only if this assistant ever gains a multi-user or shared-session context.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-ask-the-assistant-about-youtrack-data.md`
  summary: A model-issued tool call's JSON arguments are never validated against the tool's own declared `inputSchema` before being sent to `callAllowedTool`/the real MCP `callTool` — malformed-but-parseable arguments (e.g. wrong types, missing required fields) are left entirely to the MCP server to reject.
  evidence: Blind Hunter review flagged this. The MCP server is already the schema authority for its own tools and returns a normal tool-error result for bad arguments (handled by the existing `result.isError` path), so this is defense-in-depth rather than a gap that lets anything unsafe through. Low priority; revisit only if malformed-argument tool errors turn out to be a frequent, confusing failure mode in practice.
