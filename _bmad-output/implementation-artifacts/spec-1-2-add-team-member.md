---
title: 'Add Team Member'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No Team Member can be added yet — the roster is empty and there's no way to populate it, which blocks every other story in this epic (allocation, leave, sprint assignment all need Team Members to exist).

**Approach:** Add the `TeamMember` Prisma model and its first migration, wire up the first domain/infrastructure pair following the hexagonal ports-and-adapters pattern (a `TeamMemberRepo` port in `domain/`, a Prisma-backed adapter in `infrastructure/db/`), then a Server Action and a minimal Roster page with an add-member form. This is also the story that finishes Story 1.1's deferred driver-adapter setup, since this is the first code that actually instantiates `PrismaClient`.

## Boundaries & Constraints

**Always:**
- Install `@prisma/adapter-pg` and `pg` (+ `@types/pg` as a dev dependency) — Prisma 7's `prisma-client` generator requires a driver adapter for runtime use; this was deferred from Story 1.1 and is now required.
- `domain/allocation.ts` stays framework-free: it defines a `TeamMemberRepo` port (a TypeScript interface) and the `addTeamMember` function that validates input and calls the injected repo — it must not import `@prisma/client`, `next`, or anything from `infrastructure/`.
- `infrastructure/db/team-member-repository.ts` implements `TeamMemberRepo` using the Prisma client from `infrastructure/db/client.ts`. `infrastructure/db/client.ts` throws a clear error at construction time if `DATABASE_URL` is unset (don't rely solely on Prisma CLI-time checks — this was flagged as a gap during Story 1.1's review).
- The Server Action (`app/actions/team-members.ts`) is the only place that wires the domain function to the concrete repository; it returns the `{ok:true,data}` / `{ok:false,error}` discriminated result, never throws to the caller.
- `TeamMember` Prisma model: `id` (`cuid()`), `name` (`String`), `workingHoursPerDay` (`Int`), `archivedAt` (`DateTime?`, nullable, unused until Story 1.3) — no other fields; don't add audit timestamps or anything not required yet.
- Name is required — reject (validation error) when missing or blank (after trimming whitespace).
- The Roster page shows an empty-state invitation ("No team members yet — add your first one to start planning") when no Team Members exist, not a bare empty table — per `EXPERIENCE.md` State Patterns.
- Run the migration (`npx prisma migrate dev`) against the real Supabase connection now available in `.env` — use the Session pooler string (see `.env.example`), and note that DB-touching commands need the local sandbox's network restriction disabled for port 5432.

**Ask First:**
- _None known._

**Never:**
- No remove/soft-delete logic yet (that's Story 1.3) — `archivedAt` exists on the model but nothing sets or reads it in this story.
- No Allocation Category or Allocation % logic yet (Stories 1.4/1.5) — this story only adds the bare Team Member record.
- No raw Prisma calls from `app/` — every write goes through `domain/allocation.ts`'s `addTeamMember`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Valid name + working hours | Team Member is created and appears on the Roster immediately | N/A |
| MISSING_NAME | Name omitted or blank/whitespace-only | Submission rejected | Server Action returns `{ok:false, error}`; form shows the validation message, no record created |
| DB_UNREACHABLE | `DATABASE_URL` unset or invalid at repo construction | Clear, specific error, not a generic crash | `infrastructure/db/client.ts` throws with a message naming the missing/invalid env var |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — currently has only the `datasource`/`generator` blocks (Story 1.1), no models. Add `TeamMember` here.
- `domain/README.md` — placeholder to replace with `domain/allocation.ts`.
- `infrastructure/db/README.md` — placeholder to replace with `infrastructure/db/client.ts` and `infrastructure/db/team-member-repository.ts`.
- `tsconfig.json` — already has `@/domain/*` and `@/infrastructure/*` path aliases (Story 1.1) — use them, don't add new ones.
- No `app/actions/` or `app/(pm)/` directories exist yet — this story creates both.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `@prisma/adapter-pg`, `pg` (dependencies) and `@types/pg` (devDependency) -- Prisma 7 requires a driver adapter for runtime client use.
- [x] `prisma/schema.prisma` -- add `model TeamMember { id, name, workingHoursPerDay, archivedAt }` -- first real data model.
- [x] Run `npx prisma migrate dev --name add_team_member` against the live Supabase connection -- creates the actual table.
- [x] `infrastructure/db/client.ts` -- Prisma client singleton using `PrismaPg` adapter, throws a clear error if `DATABASE_URL` is missing/empty before constructing the adapter.
- [x] `infrastructure/db/team-member-repository.ts` -- implements the `TeamMemberRepo` port (`create`, `list`) against the Prisma client.
- [x] `domain/allocation.ts` -- defines the `TeamMemberRepo` port type and the `addTeamMember(repo, input)` function: validates `name` is non-blank, calls `repo.create`, returns the discriminated result.
- [x] `app/actions/team-members.ts` -- Server Action `addTeamMemberAction`, wires `addTeamMember` to the concrete repository, `'use server'`.
- [x] `app/(pm)/roster/page.tsx` -- lists Team Members (empty-state invitation when none exist) and a form that calls `addTeamMemberAction`. (Split into `page.tsx` + `add-team-member-form.tsx` client component for the `useActionState` form — not a deviation, just a natural component boundary.)

**Acceptance Criteria:**
- Given I am on the Team Roster screen, when I add a new Team Member with a name and default Working Hours, then the Team Member appears on the roster immediately and is available to be selected for Allocation, Leave, and Sprint assignment (i.e., persisted and listed, not just shown optimistically).
- Given I try to add a Team Member without a name, when I submit the form, then the system rejects the submission with a validation error and no record is created.
- Given no Team Members exist yet, when I view the Roster page, then I see an invitation to add the first one, not a bare empty table.

## Spec Change Log

## Design Notes

`domain/allocation.ts` takes its repository as a parameter (`addTeamMember(repo, input)`) rather than importing Prisma directly — this is the ports-and-adapters pattern the Architecture Spine's AD-1 requires, and it's the first time this project wires it up, so it sets the pattern every later domain function (leave, capacity, sprint) follows: domain defines the port (interface) and the pure orchestration/validation, infrastructure implements the port against a real database, and the Server Action is the only place that wires the two together. Example shape:

```typescript
// domain/allocation.ts
export type TeamMemberRepo = { create(data: {...}): Promise<TeamMember> }
export async function addTeamMember(repo: TeamMemberRepo, input: unknown) {
  if (!input.name?.trim()) return { ok: false, error: 'Name is required' }
  const data = await repo.create({ name: input.name.trim(), workingHoursPerDay: input.workingHoursPerDay ?? 8 })
  return { ok: true, data }
}
```

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npx prisma validate` -- expected: schema valid.
- `npm run lint` -- expected: clean.
- `npx prisma migrate dev --name add_team_member` -- expected: migration applies successfully against the live Supabase connection (requires the sandbox network restriction disabled for port 5432, per Story 1.1's note).
- `npm run dev` + manually add a Team Member via the Roster page, then verify the record persists (e.g. via `npx prisma studio` or a repository `list()` check) -- expected: HAPPY_PATH and MISSING_NAME rows both behave as specified.

## Suggested Review Order

**Domain: validation and the ports-and-adapters pattern**

- Start here — the pure `addTeamMember` validation, and the `TeamMemberRepo` port this whole story hangs off.
  [`allocation.ts:29`](../../domain/allocation.ts#L29)

- Two hardened rules from review: working-hours range and name length, both server-side now.
  [`allocation.ts:25`](../../domain/allocation.ts#L25)

**Server Action: the error-handling contract**

- Three review fixes live here: type-guarded FormData, sanitized error message, isolated `revalidatePath` failure.
  [`team-members.ts:13`](../../app/actions/team-members.ts#L13)

- The `try/catch` that review proved actually works — and originally leaked internal errors before the fix.
  [`team-members.ts:36`](../../app/actions/team-members.ts#L36)

**Infrastructure: the Prisma adapter and repository**

- First real `PrismaClient` in the codebase; the `DATABASE_URL` guard now also catches whitespace-only values.
  [`client.ts:4`](../../infrastructure/db/client.ts#L4)

- `list()` filters `archivedAt: null` — a no-op today, future-proofed for Story 1.3's soft delete.
  [`team-member-repository.ts:8`](../../infrastructure/db/team-member-repository.ts#L8)

**Database schema**

- First real model; the `CHECK` constraint from review lives in the migration, not visible here directly.
  [`schema.prisma:15`](../../prisma/schema.prisma#L15)

**UI**

- Roster page: empty-state invitation, the list, and the form.
  [`page.tsx:11`](../../app/(pm)/roster/page.tsx#L11)

- New error boundary for this route segment, added by review.
  [`error.tsx:3`](../../app/(pm)/roster/error.tsx#L3)

**Results (this pass):**
- `npx tsc --noEmit`, `npx prisma validate`, `npm run lint` — all clean.
- `npx prisma migrate dev --name add_team_member` — applied successfully against the live Supabase session-pooler connection.
- HAPPY_PATH — verified via Playwright E2E against the running dev server: added "Priya Sharma" / 6 hours, appeared on the roster in the same round trip, confirmed persisted (not optimistic-only) via a page reload triggering a fresh SSR read. Test row cleaned up afterward.
- MISSING_NAME — verified via Playwright E2E: whitespace-only name submitted (bypassing the HTML `required` attribute), Server Action rejected with "Name is required," no record created, roster still showed the empty state.
- Empty-state copy — verified matches `EXPERIENCE.md` exactly: "No team members yet — add your first one to start planning."
- DB_UNREACHABLE — actually exercised (not just code-read): `DATABASE_URL` blanked, fresh `npm run dev`, `/roster` returned HTTP 500 with the exact thrown message ("DATABASE_URL environment variable is not set. Set it in .env (see .env.example) before using the database.") surfaced in both the dev error overlay and the server log, naming `infrastructure/db/client.ts:7:11`. `.env` restored and diffed byte-for-byte against a pre-test backup; app reverified working (HTTP 200, empty state) afterward.

**Post-review patch pass:** Verification Gap review correctly identified that DB_UNREACHABLE's test above only exercises the module-load-time crash path, never `addTeamMemberAction`'s own `try/catch` around a live `repo.create` failure — a genuinely different code path. Re-verified directly: with the server already running (no restart), `team-member-repository.ts`'s `create` was temporarily made to throw; the form correctly showed a friendly inline alert rather than crashing, which also proved the raw-error-leak concern (patch #3 below) was real, since the alert showed the internal `"simulated failure"` message verbatim before the fix. 9 patch-level findings applied and re-verified: `workingHoursPerDay` server-side validation (integer 1–24) plus a matching DB `CHECK` constraint (independently confirmed via a raw `pg` insert), sanitized generic error message to the client, `list()` now filters `archivedAt: null`, 200-char name limit, a route-segment `error.tsx` boundary, FormData type guards against non-string values, whitespace-only `DATABASE_URL` now caught, and `revalidatePath` failures no longer mask a successful save. 4 findings deferred (see `deferred-work.md`): duplicate-name handling (needs a PM product decision), unit tests for `domain/allocation.ts` (ties to the standing test-runner deferral), per-field ARIA error association, and nothing else outstanding. Full Verification section re-run after patching — all commands still pass, including `npx prisma migrate status` confirming both migrations applied.
