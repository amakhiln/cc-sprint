# Addendum — Sprint & Velocity Planner

Implementation-leaning detail that doesn't belong in the PRD body but should carry forward to architecture.

## Tech stack (user-decided)
- Frontend/backend: Next.js (single app, no separate backend service specified).
- Persistence: needs storage for roster, allocation history, leave, sprints, and velocity history — no DB chosen yet; an architecture decision, not a PRD one.

## YouTrack MCP server — capability notes
Source: https://www.jetbrains.com/help/youtrack/server/model-context-protocol-server.html
- Exposes: issue search/read/create/update, comments, tags, issue links, article (knowledge base) search/read/create/update, project discovery, user/group lookup, time-tracking work-log entries.
- `[UNVERIFIED — docs only]` It does **not** appear to expose a native sprint or agile-board object — this was read from documentation, not confirmed against a live MCP server's actual tool list. This app's design assumes it must own Sprint/board concepts entirely (YouTrack as a Backlog Issue source only). That assumption should be re-verified by connecting to a real YouTrack MCP server and enumerating its tools before architecture commits to owning Sprint state entirely in-app. If a sprint/board-adjacent tool does exist, the integration boundary in PRD §4.4/§4.5 may need to change.
- Auth: OAuth (browser-approval) or permanent token.
- Visibility: requests run with the permissions of the authenticated user/token — the app can pull only what that identity can see. YouTrack can additionally hide specific projects/issues from AI tools even if the token could otherwise see them.
- Write capability exists (create/update issues, log time) but PRD FR-17 explicitly scopes v1 to read-only use — worth re-confirming with the PM before architecture locks in a read-only client, since it constrains future work like "mark issue done from this app."
- v1 connects to a single YouTrack Project (PRD FR-16), not multiple — simplifies the estimate-field-name assumption in FR-18 to one instance-wide config value.
- FR-14's Actual Velocity now reads YouTrack's time-tracking work-log data specifically (not the estimate field). This is a new operational dependency on the team actually logging time in YouTrack — a practice that doesn't exist today, per the PRD's own account of current practice (§1 Vision: "guessed, not calculated"). Architecture should treat "team logs time in YouTrack" as a precondition to validate, not an assumption to build around silently.

## Read-only Team View — privacy/network consideration
- FR-24 assumes an internal/trusted network deployment because the view has no login, and now also requires an unguessable link token as a cheap baseline safeguard regardless of network trust. If this ever needs to be reachable from outside a trusted network (e.g. remote team members), revisit whether the token alone is still sufficient or whether real authentication is needed.

## Query Assistant (§4.7) — implementation notes
- **Tool-calling boundary:** the assistant should be given an explicit allowlist of read/query-capable YouTrack MCP tools (issue search/read, time-tracking read, project/user/article lookup) at registration time, not a full pass-through of whatever the MCP server exposes filtered by prompt instruction. This is what makes FR-26 an enforced boundary rather than a request. Confirm against a live MCP server's tool list which tools are genuinely read-only (see PRD Open Question 4) before finalizing the allowlist.
- **Domain-data access (FR-27):** answering allocation/capacity/velocity questions means the assistant (or its backing Server Action) needs to call into `domain/` — same as any other `app/` adapter per the hexagonal architecture (`project-context.md`). No new import direction is needed; `domain/` still never imports the assistant or `infrastructure/youtrack/`.
- **Grounding approach:** FR-25's "never fabricate a figure" requirement implies each answer should be produced by executing a real tool call / domain query and formatting its result, rather than letting the model free-generate numbers from conversation context — an architecture/prompt-design decision, not a PRD one.
- **LLM provider/model choice, conversation storage (if any), and rate limiting/cost controls** are unmade — deferred to architecture.
