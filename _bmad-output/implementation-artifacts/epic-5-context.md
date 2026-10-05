# Epic 5 Context: Conversational Query & Reporting Assistant

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give the PM a chat interface where natural-language questions get answered from real data — pulled live and read-only from a YouTrack MCP server, or computed from this app's own domain data (Capacity, Allocation, Leave, Velocity, Sprints) — instead of the PM navigating between report screens or mentally combining two sources. It matters because every answer must be grounded and source-attributed rather than a plausible-looking guess, and because this introduces a second, independent, read-only connection to YouTrack (via MCP) alongside the existing REST integration.

## Stories

- Story 5.1: Connect a YouTrack MCP Server
- Story 5.2: Ask the Assistant About YouTrack Data
- Story 5.3: Ask the Assistant About This App's Own Data Too

## Requirements & Constraints

- Every numeric/factual answer must trace back to an actual query result (an MCP tool call or an app domain computation); if a question can't be grounded (too ambiguous, no matching capability), the assistant says so instead of guessing.
- Only read/query-capable tools are ever registered or advertised to the LLM — issue search/read, time-tracking read, project/user/article lookup. Write-capable tools (issue create/update, comment, tag, issue-link, article create/update, log time) must never be reachable, no matter how a prompt is phrased.
- Cross-source answers must attribute each figure to its actual origin (YouTrack MCP vs. this app's computation) — never blended into one unlabeled number.
- The assistant is reachable only from the PM's own editing session — no chat entry point, endpoint, or route exists on the anonymous read-only Team View share link.
- A connection failure, unreachable MCP server, or tool-call timeout must surface as a clear inline error, never a silent wrong answer or an indefinite hang.
- The YouTrack MCP server (per JetBrains docs, not yet verified against a live server) exposes issue search/read/create/update, comments, tags, issue links, article search/read/create/update, project discovery, user/group lookup, and time-tracking work-log entries — but no native sprint/agile-board object, so this app owns all Sprint/board state itself. Requests run with the permissions of whatever token/user is configured.
- Out of scope for this epic: writing back to YouTrack, exportable/downloadable reports (chat answers are in-conversation only), and any assistant access from the read-only Team View.

## Technical Decisions

- A new server-only adapter owns the MCP connection, entirely separate from the existing REST YouTrack adapter — separate module, separate singleton config record (server URL, auth token stored server-side only, project id), even when both point at the same YouTrack instance; the two project ids are never assumed identical.
- One shared allowlist constant filters the MCP server's tool list at registration *and* is the exact set advertised to the LLM as callable — a single source of truth so registration and what the model can see can never drift apart.
- The LLM tool-calling loop is composed by injection with its data sources, never by importing the MCP adapter directly (no infra-to-infra imports, matching this codebase's existing convention). The actual wiring — loading Sprint/roster/allocation/leave data, calling the pure domain compute functions, and calling the registered MCP tools — happens at the API route layer, which stays thin.
- Grounding is enforced by construction, not instruction: the model only chooses which tool/computation to invoke and drafts surrounding prose; every number or fact in the response is substituted in by app code from that call's real return value. There is no path where the model's own output can produce an unmediated figure.
- For the currently active Sprint, Capacity/Allocation/Velocity figures are computed live via the same functions the Sprint Plan screen uses. For an already-closed Sprint, the assistant reads that Sprint's persisted snapshot values instead of recomputing — consistent with how every other screen shows closed-Sprint numbers.
- The response protocol is a small tagged/streamed shape (text chunks, source-attribution markers, error), mirroring this app's existing result-shape convention rather than a bare token stream.
- The assistant's route is wired only into the PM's own editing UI — never imported by or reachable from the anonymous share-link view; there is no session/auth model behind this distinction, only route-tree separation.
- LLM provider is Anthropic Claude (Messages API, tool use), assumed to be a small/fast current model given low internal volume; kept swappable behind the adapter boundary.
- Roster, allocation, leave, and YouTrack data are sent to the LLM provider as-is, unredacted — treated as internal single-team data, not customer/health/financial PII; no pseudonymization layer.
- Before implementing the read-only enforcement, the assumed read-vs-write tool split (currently sourced from documentation only) needs a one-time check against the PM's actual reachable MCP server's tool list.

## Cross-Story Dependencies

- Stories 5.2 and 5.3 both require Story 5.1's saved MCP connection and its registered read-only tool set to exist first.
- Story 5.3's app-domain answers depend on the Capacity/Allocation/Velocity compute functions and closed-Sprint snapshot data already established in earlier epics (Epics 1–4) — it reuses them rather than recomputing independently.
- Configuring the MCP connection (Story 5.1) is separate, additional PM-facing setup distinct from the existing YouTrack REST "connect" flow used for backlog browsing (Epic 3) — the two connections and their credentials are independent even when pointed at the same YouTrack instance.
