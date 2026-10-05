# Project Context

Next.js (App Router) + Prisma + Supabase Postgres app, following a lightweight
hexagonal architecture:

- `domain/` — framework-free business logic and entities. No imports from
  `app/` or `infrastructure/`.
- `infrastructure/` — adapters (`db/` for the database, `youtrack/` for the
  YouTrack integration). Implements interfaces the domain defines; may import
  from `domain/`, never the reverse.
- `app/` — Next.js routes, UI, and Server Actions. Wires `domain/` and
  `infrastructure/` together; the only layer allowed to import both.
- `prisma/` — schema and migrations.

Full architecture spine:
`_bmad-output/planning-artifacts/architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md`
