---
title: 'Project Scaffold from Starter Template'
type: 'chore'
created: '2026-08-13'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No project exists yet. Every other story in Epic 1 (and every later epic) needs a working, correctly-structured Next.js app with the hexagonal directory layout and a live database connection to build on.

**Approach:** Scaffold via `create-next-app` (Next.js 16.3.x, App Router, TypeScript, Tailwind CSS, Turbopack default bundler), add the `domain/`, `infrastructure/`, `prisma/` directory skeleton per the Architecture Spine's Structural Seed, initialize Prisma against a Supabase Postgres datasource, and verify the connection.

## Boundaries & Constraints

**Always:**
- Use `create-next-app`'s official Next.js 16.3.x flow: App Router, TypeScript, Tailwind CSS, Turbopack, ESLint — all defaults, no ejecting.
- Answer "No" to `create-next-app`'s `src/` directory prompt — the Architecture Spine's tree puts `app/`, `domain/`, `infrastructure/`, `prisma/` at the project root, not nested under `src/`.
- Create the `domain/`, `infrastructure/db/`, `infrastructure/youtrack/` directory skeleton with placeholder-only content (no business logic) — later stories populate these.
- Initialize `prisma/schema.prisma` with a `postgresql` datasource reading `DATABASE_URL` from an environment variable, and a `generator client` block. Do not define the TeamMember/Sprint/etc. data model yet — per the epics' own "create tables only when needed" principle, later stories introduce models incrementally.
- Add `.env.example` documenting the required `DATABASE_URL` shape (placeholder value, no real credentials).
- Ensure `.gitignore` excludes `.env`, `node_modules`, `.next`.

**Ask First:**
- _Resolved:_ no Supabase credentials will be supplied for this story. Build the schema, `.env.example`, and Prisma config to be structurally ready for a Postgres connection; the human verifies the live connection manually afterward. Do not fabricate or hardcode a connection string.

**Never:**
- No Team Roster, Allocation, Sprint, or any other business logic, UI screen, or Server Action in this story — that starts at Story 1.2.
- No real database credentials committed to the repo.
- No deviation from the Architecture Spine's chosen stack (Next.js version, ORM, bundler).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Valid `DATABASE_URL` in `.env` | A Prisma connection check succeeds against the Supabase Postgres instance | N/A |
| MISSING_ENV | No `DATABASE_URL` set | Prisma commands fail with a clear "environment variable not found" error | Documented in `.env.example` and README setup steps, not papered over in code |

</frozen-after-approval>

## Code Map

- _No existing code._ This is the initial commit for the project — nothing to reuse, nothing read-only to respect.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `next.config.*`, `tsconfig.json`, `tailwind.config.*` (repo root) -- run `create-next-app` with App Router/TS/Tailwind/Turbopack, no `src/` dir -- establishes the base app per the Architecture Spine's Stack table.
- [x] `app/`, `domain/`, `infrastructure/db/`, `infrastructure/youtrack/`, `prisma/` -- create the hexagonal directory skeleton (placeholder file per empty dir, e.g. `.gitkeep` or a one-line comment file) -- matches the Structural Seed so later stories have a home without inventing structure ad hoc.
- [x] `prisma/schema.prisma` -- initialize with `postgresql` datasource + `generator client`, no data models yet -- wires the ORM without inventing the schema early.
- [x] `.env.example` -- document the `DATABASE_URL` variable -- onboarding without leaking secrets.
- [x] `.gitignore` -- confirm `.env`, `node_modules`, `.next` excluded -- standard hygiene.
- [x] `README.md` -- brief setup steps (install, set `DATABASE_URL`, `npm run dev`) -- so the human can actually run what this story produces.

**Acceptance Criteria:**
- Given no project exists yet, when the project is scaffolded via `create-next-app` with App Router, TypeScript, and Tailwind CSS, then the app runs locally and serves the default starter page.
- Given the scaffolded project, when the hexagonal directory structure is added, then `app/`, `domain/`, `infrastructure/`, and `prisma/` folders exist per the Architecture Spine's Structural Seed.
- Given the directory structure exists, when Prisma is initialized and pointed at a Supabase Postgres database, then a Prisma schema file exists and a test connection to the database succeeds.

## Spec Change Log

## Design Notes

`create-next-app` defaults to a `src/` layout on some prompts/versions; explicitly decline it here since the Architecture Spine's Structural Seed diagram places `app/`, `domain/`, and `infrastructure/` as root-level siblings, not children of `src/`. Getting this wrong in the scaffold would mean every later story's file paths are wrong too.

## Verification

**Commands:**
- `npm run dev` -- expected: dev server starts, default Next.js page loads at `localhost:3000`.
- `npx tsc --noEmit` -- expected: no type errors.
- `npx prisma validate` -- expected: `schema.prisma` is syntactically valid.

**Manual checks (if no CLI):**
- The live Supabase connection test (`npx prisma db pull` or equivalent against a real `DATABASE_URL`) is deferred to the human per the resolved **Ask First** decision — not run as part of this story's automated verification.

**Results (this pass):**
- `npx tsc --noEmit` — passed, no errors.
- `npx prisma validate` — passed, schema valid.
- `npm run lint` — clean.
- `npm run dev` + `curl localhost:3000` — HTTP 200, default Next.js starter page served.
- MISSING_ENV matrix row — verified: `.env` temporarily removed, `npx prisma db pull` failed with the expected explicit "datasource.url property is required" error, `.env` restored.
- HAPPY_PATH matrix row — **verified post-hoc** once the human supplied real Supabase credentials (during Story 1.2 planning): `npx prisma db pull` reached the database successfully (`P4001`, "introspected database was empty" — expected, since no migration has run yet). Getting here required two corrections beyond the original deferral: (1) Supabase's Transaction pooler (port 6543) connects but doesn't support the session-level operations `db pull`/migrations need (`P1017`) — switched to the Session pooler (port 5432, same `pooler.supabase.com` host) instead, which Prisma 7 requires since `directUrl` was removed from `prisma.config.ts` in that version; (2) the local tool sandbox was blocking outbound port 5432 by default, requiring it to be disabled for DB-touching commands.

**Post-review patch pass:** 9 patch-level findings from code review (Blind Hunter, Edge Case Hunter, Verification Gap layers) applied — `.gitignore` `.env.example` negation, `postinstall: prisma generate`, pooled-connection guidance in `.env.example`, `engines.node`, `project-context.md` created, `tsconfig.json` path aliases, `.gitkeep`→`README.md` renames, cross-shell-safe README setup step, exact-pinned `prisma`/`@prisma/client` versions. Full Verification section re-run after patching — all commands still pass. 3 findings deliberately deferred (see `deferred-work.md`): Prisma 7 driver-adapter package for Story 1.2, an explicit runtime `DATABASE_URL` guard for Story 1.2's `infrastructure/db/` code, and an automated test for the missing-env fail-fast behavior once a test runner is chosen.

## Suggested Review Order

**Architecture entry point**

- Start here — explains the hexagonal layering every later story follows.
  [`project-context.md:1`](../../project-context.md#L1)

**Directory skeleton**

- Domain layer placeholder — framework-free business logic starts here in Story 1.2.
  [`domain/README.md:1`](../../domain/README.md#L1)

- Infrastructure adapters — DB and YouTrack adapters land here, never imported by domain.
  [`infrastructure/db/README.md:1`](../../infrastructure/db/README.md#L1)

- YouTrack adapter placeholder, same isolation rule as the DB adapter.
  [`infrastructure/youtrack/README.md:1`](../../infrastructure/youtrack/README.md#L1)

**Database config**

- Postgres datasource + client generator, no data models yet by design.
  [`prisma/schema.prisma:6`](../../prisma/schema.prisma#L6)

- Prisma 7 reads `DATABASE_URL` here at CLI time, not in the schema file.
  [`prisma.config.ts:11`](../../prisma.config.ts#L11)

- Documents the required env var, including the pooled-vs-direct Supabase distinction.
  [`.env.example:1`](../../.env.example#L1)

**Build & tooling config**

- `postinstall` regenerates the Prisma client automatically; `engines` pins a compatible Node.
  [`package.json:5`](../../package.json#L5)

- Path aliases for clean cross-layer imports (`@/domain/*`, `@/infrastructure/*`) without deep relatives.
  [`tsconfig.json:21`](../../tsconfig.json#L21)

- `.env.example` is explicitly un-ignored so it actually ships to fresh clones.
  [`.gitignore:34`](../../.gitignore#L34)

**Peripherals**

- Cross-shell-safe setup steps, including the Prisma env-var behavior.
  [`README.md:1`](../../README.md#L1)

- Unmodified `create-next-app` defaults — the starter page this story's AC checks against.
  [`app/page.tsx:1`](../../app/page.tsx#L1)
