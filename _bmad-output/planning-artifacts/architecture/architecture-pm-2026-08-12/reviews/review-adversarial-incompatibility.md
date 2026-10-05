# Adversarial Incompatibility Review — ARCHITECTURE-SPINE.md (2026-08-25 amendment)

Target: `_bmad-output/planning-artifacts/architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md`
Scope: AD-7, AD-8, the AD-3 amendment, and their interaction with AD-1/AD-2/AD-4/AD-5/AD-6 and the Consistency Conventions table.
Method: for each finding, two (or more) concrete units one level down (stories/PRs) that each satisfy the letter of every applicable Rule, yet are built on incompatible assumptions.

Verdict up front: **the spine is not safe to hand to two independent implementers as-is.** The two new ADs (AD-7, AD-8) are solid on the *prohibition* side (no write tools, no share-token reachability) but leave the *composition* side — how the assistant actually assembles an app-data answer, and what happens at the transport layer — underspecified. The single most serious hole is #3 below: AD-8's own two named call surfaces (`domain/`, `youtrack-mcp/`) are, by AD-1's own definition of "pure," insufficient to answer any app-data question that needs a specific Sprint's data — there's no third surface (`infrastructure/db/`) granted, so implementers will resolve it in mutually incompatible, spine-violating ways.

---

## Finding 1 — `YouTrackMcpConfig` has no project scope, and no FR/story owns configuring it

**The clash:** AD-3's `YouTrackConfig` singleton carries `instanceUrl`, `authToken`, **and `projectId`** — this app is project-scoped. AD-7's new `YouTrackMcpConfig` singleton (per the ER diagram) carries only `mcpServerUrl` and `authToken` — **no `projectId` field**, even though AD-7 says the two configs may "happen to point at the same YouTrack instance." Nothing says whether the MCP tools (issue search, time-tracking read, project/user/article lookup) are meant to operate over the same single project the REST adapter is scoped to, or over whatever the MCP server's token can see.

- **Story A (implements AD-7's tool adapter):** builds `infrastructure/youtrack-mcp/` tool wrappers with no project filter — "issue search" takes whatever query args the LLM passes, unscoped, because `YouTrackMcpConfig` (the only config this adapter is allowed to touch, per AD-7's "independent of `infrastructure/youtrack/`") has no `projectId` to filter by. This obeys AD-7's rule to the letter: two separate adapters, two separate configs, no cross-import.
- **Story B (implements AD-8's orchestrator):** assumes — reasonably, since the rest of the app is single-project — that assistant answers are implicitly scoped to "the" project, and either (a) reaches across into `infrastructure/youtrack/`'s `YouTrackConfig.projectId` to filter results (violating AD-7's independence rule while still nominally "just reading a project id"), or (b) hardcodes a project id string in `infrastructure/query-assistant/`, creating a second, undeclared place project scope is configured.

Both stories individually satisfy their AD's Rule text. The result: either cross-instance data leaks into assistant answers (a JetBrains org token can usually see every project it's a member of), or two adapters silently disagree on where "the project" comes from, or a duplicate/hardcoded project id appears outside the two blessed config singletons. AD-7 also binds only FR-25/FR-26 and never allocates a story for *configuring* `YouTrackMcpConfig` (no analogue to FR-16's settings surface) — so it's also unclear whether it's entered via a settings page, an env var, or a migration seed, and two implementers can each build a plausible but different answer to that too.

**Close the hole:** add a `projectId` field to `YouTrackMcpConfig` (or an explicit Rule stating tools are intentionally unscoped and why that's safe for a read-only allowlist), and name the story/FR that owns entering its value.

---

## Finding 2 — no calling convention specified for `domain/` functions consumed by non-Server-Action callers

AD-1's Rule requires domain functions to be pure with zero framework imports; the Consistency Conventions table pins the `{ok:true,data}|{ok:false,error}` discriminated-result convention specifically to **Server Actions'** return values ("so the UI has one uniform error-handling shape"). Nothing in the spine says what a `domain/` function itself returns on invalid input — throws a plain `Error`, or already returns the discriminated shape that Server Actions then just pass through.

- **PR A** (existing convention, written before AD-8 existed): `domain/capacity.ts` and friends throw on invalid input; the Server Action wraps every call in try/catch and produces the `{ok,error}` shape at the Server Action boundary. This is a completely reasonable reading of AD-1 + the Conventions table as written.
- **PR B** (implements AD-8's "`infrastructure/query-assistant/` ... calls `domain/`'s existing functions ... directly"): since the *only* documented result shape anywhere in the spine is `{ok,data}|{ok,error}`, the implementer assumes domain functions already return that shape and writes `const result = capacity.compute(...); if (!result.ok) return errorReply(result.error);` — which either silently swallows a thrown exception (crashes, no `{ok:false}` to check) or, worse, treats a truthy non-discriminated return value as `{ok:true}` and reads `.data` off a plain object that doesn't have it.

Both PRs are "calling domain/ functions directly" exactly as AD-8 instructs. Whether that call needs a try/catch or a `.ok` check is never pinned down anywhere a non-Server-Action caller can see, and PR A and PR B were plausibly written by people who never saw each other's code.

**Close the hole:** state explicitly, as an AD-1 (or new) Rule, what a `domain/` function's error-signaling contract is (throw vs. return-discriminated), independent of what Server Actions expose to the UI.

---

## Finding 3 — AD-8 names only two call surfaces for the assistant; neither can actually answer a Sprint-scoped question (the load-bearing one)

This is the deepest structural gap, and it follows directly from AD-1's own definition of "pure":

- AD-1: domain functions have "zero Prisma/Next.js/MCP imports." That means `capacity.ts`'s compute function cannot take a `sprintId` and fetch the Sprint/TeamMember/Allocation/Leave/Holiday rows itself — by construction, it must be handed already-fetched data as arguments (this is exactly how the existing Server Action pattern works, per the Structural Seed comment: Server Actions are "thin: validate input, call domain, call repositories" — three roles, not two).
- AD-8's Rule says the assistant "calls `infrastructure/youtrack-mcp/`'s registered tools ... for YouTrack-sourced answers, and calls `domain/`'s existing functions ... directly for app-data answers." That names exactly **two** surfaces. The repository/fetch role that Server Actions play themselves (`infrastructure/db/`) is never granted to `infrastructure/query-assistant/` — and the architecture diagram at the top of the spine draws only `QAAdapter --> Domain` and `QAAdapter --> MCP`, no `QAAdapter --> Infra`.

So: "what's the current Sprint's capacity?" cannot be answered by calling a domain function alone — something has to fetch the current active Sprint (AD-6) and its roster/allocation/leave/holiday rows first. Three equally "AD-8-compliant" resolutions:

- **PR A:** adds a Prisma import to `domain/capacity.ts` itself (a self-fetching convenience wrapper "just for the assistant"), directly violating AD-1's zero-Prisma-imports Rule, while technically still "calling a domain/ function directly" per AD-8.
- **PR B:** has `infrastructure/query-assistant/` import `infrastructure/db/` repositories directly to assemble the raw inputs, then calls the pure domain function — plausible, arguably correct, but it's an entirely new dependency edge AD-8 never names or grants, and nothing stops the "assembly" logic (e.g., filtering to non-archived team members, picking "the" active sprint) from quietly reimplementing a decision domain/ should own — the exact AD-1 divergence risk AD-1 exists to prevent, now with a third call site.
- **PR C:** avoids both by only answering questions domain/'s *existing* exported functions already cover with the exact arguments a Server Action already happens to have lying around, and simply declining ("ungroundable question") every question that needs a fresh assembly — a materially weaker assistant than FR-25/27 presumably intend, but fully spine-compliant.

All three are defensible readings of the same sentence in AD-8. They are not compatible with each other, and B and C in particular ship visibly different assistant capabilities from the same spine.

**Close the hole:** either (a) explicitly grant `infrastructure/query-assistant/` a read-only dependency on `infrastructure/db/` repositories (updating the diagram and AD-1's "zero Prisma imports" scope note to confirm it's domain/ only, not infrastructure/ generally), or (b) require a Server-Action-style "assembly" layer the assistant must call instead of touching domain/ or db/ separately, or (c) require every domain/ function the assistant needs to be reachable via a small set of named, self-fetching **wrapper functions living in `infrastructure/query-assistant/` itself** that call repositories then domain — and say so.

---

## Finding 4 — AD-2 snapshot vs. live-compute divergence for closed-Sprint questions

Following directly from #3: even once an implementer picks a way to fetch inputs, AD-2 requires closed Sprints to be read from **persisted snapshot fields** (`snapshotCapacityHours`, `snapshotAllocationBreakdown`, `snapshotActualVelocityHours`) and "never recomputed," specifically because current-roster-based live recomputation would violate FR-2/FR-5 non-retroactivity. AD-8 never mentions Sprint status at all.

- **PR A:** for any capacity/velocity question, always calls the live `domain/capacity.ts` / `domain/velocity.ts` compute function against current roster state (this is, after all, "calling domain/'s existing functions directly for app-data answers" — the literal AD-8 instruction). For a question about a *closed* sprint whose roster has since changed (a team member archived, an allocation-% changed), this silently returns a different number than the one the UI displays for that same closed sprint.
- **PR B:** branches on `Sprint.status` and, for closed sprints, reads the persisted snapshot fields directly instead of calling a domain compute function.

Both PRs are grounded in a real tool/domain call (satisfying AD-8's anti-hallucination Rule and its attribution requirement), so neither one "looks" like a spine violation under review — the assistant never states a number it wasn't handed by a domain function or tool call. But PR A produces answers that contradict the app's own historical record for closed sprints, which is precisely the failure mode AD-2 exists to prevent, just relocated to a new call site AD-2 doesn't reach.

**Close the hole:** add an explicit clause to AD-8 (or AD-2) requiring the assistant to respect AD-2's active/closed distinction — i.e., app-data answers about a closed Sprint must come from the persisted snapshot, never from a live recompute.

---

## Finding 5 — the read-only MCP tool allowlist has no single named owner/location

AD-7 says the allowlist is enforced "at registration time" inside `infrastructure/youtrack-mcp/`. AD-8 says `infrastructure/query-assistant/` is what actually hands a tool list to the LLM (tool-calling requires passing tool *schemas* to the Messages API, not just having them "registered" somewhere). Nothing says these are the same list, or that one is mechanically derived from the other.

- **PR A** (AD-7 implementer): defines the allowlist as a private constant inside `infrastructure/youtrack-mcp/`'s registration code (5 tools: issue search, issue read, work-log read, project lookup, user lookup) and exports a `listTools()` function.
- **PR B** (AD-8 implementer, built in parallel against the same spine text): independently writes the JSON tool-schemas handed to the LLM's tool-calling API directly in `infrastructure/query-assistant/`, based on their own reading of "issue search/read, time-tracking work-log read, project/user/article lookup" in AD-7's prose — and includes "article lookup" (which PR A's list omitted, or vice versa), because the prose list and the enforced allowlist were never tied to one shared exported constant.

Neither PR violates its own AD's literal wording, yet the tool surface actually reachable by the LLM depends on which list wins, and a reviewer checking AD-7 in isolation ("no write tools in the allowlist — check") would not catch a mismatch between the two lists.

**Close the hole:** name one canonical exported allowlist (e.g., `infrastructure/youtrack-mcp/allowlist.ts`) that both `infrastructure/youtrack-mcp/`'s registration and `infrastructure/query-assistant/`'s tool-schema construction import from — not two independently maintained lists.

---

## Finding 6 — no source-of-truth rule for questions answerable by both lanes (YouTrack-live vs. app-snapshot)

AD-3 already establishes that `BacklogIssue` rows are point-in-time copies pulled from YouTrack at pull-time (title/estimate/assignee), not kept in sync afterward. AD-7's MCP allowlist includes live "issue search/read." AD-8 splits answers into "YouTrack-sourced" (via MCP) vs. "app-data" (via domain/) and requires attributing each figure to its source — but never assigns *which lane answers which question class* when both could plausibly answer it (e.g., "what's the estimate on issue FOO-123?" — the live YouTrack value via MCP, or this app's `BacklogIssue.estimateHours` snapshot from pull-time, which may already have drifted from YouTrack).

- **PR A:** treats any question mentioning an issue/backlog term as "YouTrack-sourced" and always calls the MCP `issue read` tool, per AD-7.
- **PR B:** treats any question about an issue already pulled into the current Sprint as "app-data" (it's sitting in `BacklogIssue`, reachable via `domain/`), per AD-8's app-data lane.

Both correctly label their answer's source (satisfying AD-8's attribution Rule), but the two answers can numerically disagree for the same question, and the spine gives no rule for which lane is authoritative for a pulled issue's current fields. This is a narrower version of the hallucination risk AD-8 was written to prevent — the assistant isn't inventing a number, but two equally "grounded" answers to the same question can contradict each other depending only on which PR's implementer built that question-routing branch.

**Close the hole:** add a Rule (or a row in the Capability→Architecture map) stating that once an issue has been pulled into the current/a Sprint, all its fields answer from the app's own `BacklogIssue` snapshot (consistent with AD-3's "reused/mutated" prohibition), and MCP issue-read is only used for issues not yet pulled (pure backlog browsing).

---

## Finding 7 — Route Handler streaming vs. the app's Server-Action `{ok,data}|{ok,error}` convention (explicitly flagged `[ASSUMPTION]`)

The Consistency Conventions table states the discriminated-result convention exists so "the UI has one uniform error-handling shape" — but it is written in terms of Server Actions' return values (a single in-process function return), which only makes sense for a call that resolves once. AD-8's route handler is chosen specifically "to support streaming a chat response" — i.e., a response that is *not* one resolved value but a sequence of chunks. These two things are not obviously reconcilable, and the spine never reconciles them:

- **PR A** (frontend/route implementer who takes "one uniform error-handling shape" at face value as an app-wide convention, not Server-Action-specific): implements `app/api/assistant/route.ts` to buffer the entire LLM turn server-side and return one JSON body shaped `{ok:true,data:{answer,sources}}` or `{ok:false,error}` — technically satisfying the app's stated convention, but defeating the entire reason AD-8 chose a Route Handler over a Server Action in the first place (no token-by-token streaming reaches the client).
- **PR B** (implementer who takes the `[ASSUMPTION — ... to support streaming]` note at face value): implements real streaming (e.g. chunked text/SSE), where there is no single JSON envelope to put an `{ok,error}` shape in — errors encountered mid-stream (a tool-call failure per AD-8's "surfaces as a plain inline statement in the response") are emitted as a special chunk or event, and errors encountered *before* any token is sent (bad request, MCP totally unreachable at session start) are signaled via a bare HTTP status code with a differently-shaped body, or a first SSE event carrying an ad hoc `{type:"error", message}` shape that shares no structure with `{ok:false,error}` used everywhere else in the app.

Both PRs can point to spine text supporting their choice — PR A to the Conventions table, PR B to AD-8's own streaming assumption and its "plain inline statement" phrasing. A client-side implementer building the chat UI, if they assume the app-wide convention applies here (reasonable, since it's the *only* error-shape convention documented anywhere in the spine), will write a `fetch().then(r => r.json())` client against PR A's route and get a runtime break the moment someone ships PR B's actual streaming implementation, or vice versa — a client written against a stream parser breaking against a PR-A-style buffered JSON envelope.

**Close the hole:** AD-8 (not just the Stack/Conventions table) needs its own explicit transport-error-shape Rule: e.g., "pre-stream errors return HTTP 4xx/5xx with `{error:string}` body; mid-stream tool/grounding failures are emitted as a distinguished stream event/chunk of a named shape; the app-wide `{ok,data}|{ok,error}` convention applies only to Server Actions and does not extend to this streaming route." Whatever the actual decision, it must be written down — right now the spine's only error-shape convention is silently ambiguous as to whether it even covers this route at all.

---

## Summary of recommended spine changes

1. Give `YouTrackMcpConfig` an explicit project-scope story (field + owning FR), or state it's intentionally instance-wide and justify it under AD-5/AD-7.
2. Add an explicit `domain/` function error-signaling contract (throw vs. discriminated-return) that non-Server-Action callers (AD-8) can rely on.
3. Grant `infrastructure/query-assistant/` an explicit, named path to fetch the raw inputs domain/'s pure functions require (repository access, an assembly layer, or self-fetching wrapper functions) — the current two-surface description (`domain/`, `youtrack-mcp/`) is provably insufficient given AD-1's "zero Prisma imports" definition of pure.
4. Require AD-8 to respect AD-2's active/closed distinction explicitly — no live recompute for closed-Sprint answers.
5. Name one canonical, shared allowlist constant that both the MCP-adapter's registration and the assistant's LLM tool-schema construction import from.
6. Assign a source-of-truth rule for pulled-issue fields (app snapshot wins over live MCP read once an issue is pulled), consistent with AD-3.
7. Give the streaming route handler its own explicit error/response-shape Rule, and state whether the app-wide `{ok,data}|{ok,error}` convention applies to it at all.
