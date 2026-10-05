# Rubric Walk — Architecture Spine Review

**Spine:** `architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md`
**PRD:** `prds/prd-pm-2026-08-12/prd.md` + `addendum.md`
**Reviewer role:** Rubric Walker (Reviewer Gate, Finalize step)
**Calibration:** feature-altitude spine for a single-PM internal tool (Next.js/Prisma/Supabase/YouTrack-MCP), followed directly by epics/stories — no platform/enterprise apparatus expected.

## Verdict

Solid spine — the six ADs correctly target the real correctness bugs the PRD review surfaced (leave/holiday double-counting, Dev-only-vs-all-category Capacity) and the Prevents/Rule pairs mostly hold up under scrutiny — but it has three fixable gaps that would let epics/stories diverge: unverified pinned dependency versions, a hosting deferral that quietly breaks the FR-24 capability it's supposed to protect, and no schema/security home for the YouTrack connection config that FR-16 requires the PM to save.

**Findings by severity:** Critical: 0 | High: 3 | Medium: 2 | Low: 5

---

## HIGH

### H1. Stack versions read as settled fact, not verified-current
The Stack table pins **Next.js 16.2.x**, **React 19.2**, and **Prisma 7.x** as flat, specific values with no verification marker — no "confirmed via npm/registry," no `[ADOPTED]`/`[UNVERIFIED]` tag, nothing. Contrast this with AD-3, where the spine is careful to tag the YouTrack sprint-object claim `[ADOPTED] ... confirmed directly by the PM`. The same discipline isn't applied to the dependency table, even though pinning a specific minor version (16.2.x, 19.2, 7.x) is exactly the kind of claim that's "plausible from training data" rather than checked against the actual registry on 2026-08-12. If any of these numbers is wrong, every story that scaffolds against "Next.js 16.2 App Router" behavior inherits the error silently.
`@modelcontextprotocol/sdk: latest` and `Tailwind: latest (create-next-app default)` correctly hedge — the fix is to bring Next.js/React/Prisma in line with that hedging (or explicitly verify and tag them `[VERIFIED — npm, 2026-08-12]`) before epics/stories treat them as load-bearing.

### H2. Deployment/hosting deferral undermines the capability it's attached to
Deferred says: *"Always-on hosting/deployment topology. v0 runs on the PM's own machine; FR-24's 'reachable anytime' is not yet solved."* Per the rubric's own bar, a Deferred item is only safe if it's genuinely low-stakes or clearly out of this altitude's scope. This one is neither: FR-24 / UJ-3 ("Priya checks the sprint plan... as easily as a shared doc") and the whole Team View capability (4.6, governed by AD-4/AD-5) depend on the app being reachable independent of whether the PM's laptop happens to be on. "Runs on the PM's own machine" isn't a neutral placeholder — it's a decision that makes FR-24 non-functional for anyone but the PM, and it's exactly the kind of infra/provider decision this altitude already made once (Supabase free tier for the DB). Leaving the *app's* hosting undecided while the *DB's* hosting is decided is an inconsistent envelope, not a genuine deferral. At minimum this needs a concrete placeholder (e.g., "PM to confirm a small always-on host — Vercel free tier / office VM — before FR-24 stories are built") rather than being filed next to genuinely low-stakes items like CI/CD and test-runner choice.

### H3. No architectural home for the YouTrack connection config (URL + token)
FR-16 requires the PM to "configure a connection to one YouTrack Project ... (instance URL, project, and auth token)" through the app, with inline validation and "does not save the connection" on failure — i.e., a persisted, editable settings entity, not a static env var set once at deploy time. AD-3 only says the *adapter* is server-only; it never says where the URL/token themselves live (DB table? encrypted column? env var reloaded via a settings UI?). The ERD has no `YoutrackConnection`/`Integration` entity at all. This is a real divergence point: whoever builds the "connect to YouTrack" settings screen and whoever builds the adapter can easily land on incompatible answers (one assumes `.env`, the other assumes a DB-backed, in-app-editable config with encryption-at-rest for the token) — and the token-leak-prevention half of AD-3's own Prevents clause depends on this being decided.

---

## MEDIUM

### M1. FR-1/FR-2 (Team Member add/remove) fall outside AD-1's Binds, and the underlying soft-delete question is undecided
AD-1's `Binds` line starts at FR-3, but the Capability→Architecture Map attributes all of feature 4.1 (which includes FR-1 and FR-2) to AD-1 — an inconsistency between the two. More concretely: FR-2 requires that a removed Team Member "no longer appears for new Sprint assignment" but their "Capacity and Velocity contribution in past, already-closed Sprints remains visible in Velocity History (removal is not retroactive deletion)." That's a soft-delete/archival requirement, and the ERD's `TeamMember` entity has no field to support it (no `isActive`/`archivedAt`). Left undecided, one story could hard-delete the row (breaking FK references from historical `BacklogIssue.assigneeId` / snapshot data) while another assumes soft-delete semantics — exactly the kind of two-units-diverge-incompatibly risk this checklist targets.

### M2. Unfinished-issue lifecycle on Sprint close is unspecified and the schema doesn't support the stated behavior
FR-23: "Any Backlog Issue left unfinished stays in YouTrack, unassigned from any Sprint, until manually re-pulled." The ERD's `BacklogIssue.sprintId` isn't marked nullable, and no AD or convention says whether "unassigned" means (a) the local row's `sprintId` is nulled, (b) the local row is deleted outright (since YouTrack remains the source of truth and FR-17 says re-pull always reflects current YouTrack state), or (c) it's left orphaned pointing at the closed Sprint. This is a genuine divergence point between whoever builds "close sprint" and whoever builds "browse backlog for the next sprint" — worth one line in AD-2 or AD-3.

---

## LOW

### L1. Capability Map's "Lives in" column for 4.4 doesn't match AD-1's own Binds
AD-1 binds FR-19 (over-allocation warning), which is domain comparison logic (planned hours vs. computed Capacity) — but the Capability→Architecture Map row for "4.4 YouTrack Integration" lists `Lives in: infrastructure/youtrack/` only, with no mention of the domain module that actually implements FR-19. Minor, but it's the kind of doc drift that misleads whoever picks up the epic for over-allocation warnings.

### L2. AD-3's "title" promise isn't reflected in the ERD
AD-3 states "Backlog Issue data (**title**, estimate, assignee) is copied into the local database," but the ERD's `BacklogIssue` entity has no `title`/`summary` field (also missing `priority`, which FR-17 lists as something the PM browses). Likely the ERD is illustrative rather than exhaustive — worth an explicit one-line note to that effect so epics/stories don't treat the ERD's field list as the full schema.

### L3. No convention for date/timezone handling despite this being the exact bug class AD-1 exists to prevent
Dates are stored as Postgres `date` (no time-of-day), which is the right call at the DB layer, but nothing says how the app parses/compares dates across the PM's local timezone vs. server timezone. Since AD-1 exists specifically because leave/holiday day-counting bugs were already found once, a one-line convention (e.g., "all date arithmetic operates on UTC-normalized calendar dates, never `Date` objects with time components") would close a residual risk in the same family.

### L4. AD-1/AD-4 enforcement is discipline-only, no tooling named
"Server Actions never recompute the formulas inline" (AD-1) and "no module reachable from [the share route] may import a write-capable Server Action" (AD-4) are real, sensible rules, but nothing enforces them automatically (e.g., an ESLint import-boundary rule). For a solo builder this is likely fine — flagging only so it's a conscious choice, not an oversight, since both ADs' Prevents clauses implicitly assume the rule actually holds over time.

### L5. Open Question 3's resolution method differs from what the PRD asked for
The PRD's Open Question 3 asked for the no-native-sprint-object assumption to be confirmed by "connect[ing] to a live YouTrack MCP server and confirm[ing] it truly has no sprint/agile-board tool." AD-3 closes this via `[ADOPTED] ... confirmed directly by the PM` — a verbal/PM confirmation rather than the live-server tool enumeration the PRD specified. This may well be an intentional, accepted substitution (the `[ADOPTED]` tag exists for exactly this purpose), but it's worth the architect double-checking with the PM that "confirmed directly" means "PM verified against a live server" and not just "PM is confident this is true," since AD-3 and the entire Sprint-ownership boundary (AD-2, AD-6, the whole `domain/sprint.ts` module) rests on it.

---

## What's working well (not findings, for balance)
- AD-1 through AD-6's Prevents/Rule pairs are logically tight where they matter most — AD-2 (live-vs-snapshot) correctly derives from FR-2/FR-5/FR-7's non-retroactivity vs. immediate-recalculation tension, and AD-6's DB-constraint-or-domain-guard framing correctly treats "single active sprint" as a data-integrity problem, not a UI-only one.
- AD-5's scope ("all") is honest about a decision that cuts across every other AD rather than trying to carve out a narrower binding.
- The Deferred list is otherwise well-calibrated to scale (CI/CD, observability, test-runner choice are all correctly judged low-stakes for a solo-PM internal tool) — H2 is the one exception.
- All 6 PRD features (4.1–4.6) appear in the Capability→Architecture Map, and the coarse FR-1..FR-24 range is covered at the feature level.
