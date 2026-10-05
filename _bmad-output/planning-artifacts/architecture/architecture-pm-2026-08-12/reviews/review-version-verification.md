---
name: 'Version & Technology Verification Review'
type: review
target: architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md
scope: 'Stack table + AD-3, AD-7, AD-8 (YouTrack REST, YouTrack MCP adapter, Anthropic Claude assistant)'
reviewed: '2026-08-25'
method: 'npm registry (via `npm view`), web search, WebFetch of official docs'
---

# Version Verification Review — Architecture Spine (2026-08-25 amendment)

## Verdict

All checked claims hold up. No stale or fabricated technology/version claims found in AD-3, AD-7, AD-8, or the two new Stack table rows. One thing was previously marked `[ASSUMPTION]`/`[OPEN]` in the spine and remains genuinely unconfirmed (not a research gap, a real open item) — flagged below, not something this review can close.

---

## 1. `@modelcontextprotocol/client` (package.json: `^2.0.0`)

**Real, current, non-deprecated — confirmed directly against the npm registry, not from training data.**

- Checked `npm view @modelcontextprotocol/client versions --json` and `time --json`: the package has a real, actively-published version history — `2.0.0-alpha.1` through `2.0.0-beta.5`, then a **stable `2.0.0`** published **2026-07-27**, about 4 weeks before the spine's 2026-08-25 amendment date.
- `npm view @modelcontextprotocol/client dist-tags` → `{ latest: '2.0.0' }`. The package.json range `^2.0.0` resolves to this real stable release, not a prerelease. (Caveat during research: an early web search snippet claimed the current version was still `2.0.0-alpha.2`/`beta.5` — that was a stale/cached search index; the registry itself, queried live, shows the stable `2.0.0` is out. This is exactly the kind of stale-web-summary trap the task asked to guard against, and the registry query is what resolved it.)
- `npm view @modelcontextprotocol/client deprecated` → empty (not deprecated).
- Context confirmed via GitHub (`modelcontextprotocol/typescript-sdk`): the monolithic `@modelcontextprotocol/sdk` package has been split into `@modelcontextprotocol/server` and `@modelcontextprotocol/client`. The repo's own docs state "v2 is the stable release line, released alongside the 2026-07-28 spec" — consistent with the registry timestamp. Note: the legacy `@modelcontextprotocol/sdk` package is *not* deprecated on npm either (still published, e.g. `1.30.0` on 2026-07-27) — both the old monolith and the new split packages currently coexist. Not a problem for this project (it deliberately depends on the new split `/client` package), just worth knowing if anyone searches for `@modelcontextprotocol/sdk` and assumes it's gone.

**Tool-registration/allowlist capability AD-7 assumes:** confirmed, with a nuance.

- Fetched the official v2 client docs (`ts.sdk.modelcontextprotocol.io/v2/clients/calling`). `listTools()` returns a plain aggregated `{ tools: [...] }` array (the SDK handles pagination via `nextCursor` internally); `callTool()` invokes one by name.
- There is **no special SDK "allowlist" feature** — filtering to a subset is not a named API. But the shape trivially supports it: the array is returned to application code, which is free to filter it down to an explicit subset before wiring tool definitions into Claude's tool-use loop. This is exactly what AD-7 describes ("At registration time it exposes only an explicit allowlist... to the assistant") — it's describing the *application's* registration code around the SDK, not claiming the SDK itself has a built-in allowlist primitive. AD-7's wording is accurate as written and doesn't overclaim an SDK capability that doesn't exist.
- Net: AD-7's technical assumption is sound. No all-or-nothing constraint exists that would block this design.

## 2. Anthropic Claude — "Messages API, tool use", "Claude Haiku 4.5"

**Confirmed via the bundled `claude-api` skill (authoritative, current-dated reference), not training-data recall.**

- `claude-haiku-4-5` (display name "Claude Haiku 4.5") is a real, current, non-deprecated model: 200K context, $1/$5 per MTok input/output, present in the skill's live current-models table alongside Sonnet 5, Opus 5, Fable 5, etc. It is genuinely the smallest/fastest model in the current lineup, which matches the spine's stated rationale ("small/fast current model... low-volume internal tool, no need for a larger model").
- "Messages API" and "tool_use" are correct, current terminology — `POST /v1/messages` is the (still) single endpoint for all Claude requests, tool calls surface as `stop_reason: "tool_use"` and `tool_use` content blocks, and this has not changed name or shape in the current API generation. No deprecated/renamed terminology risk here.
- The spine already flags the model choice as `[ASSUMPTION]` pending PM confirmation — that's the right posture; nothing here is silently stale, it's an explicitly open decision, not a hidden one. This review does not close it (no way to get a PM sign-off from here), just confirms the named model is real and fits the stated use case.

## 3. Other Stack-table items touched by these ADs

- Everything else in the Stack table (Next.js, React, TypeScript, Prisma, Supabase, Tailwind) is unchanged by AD-3/AD-7/AD-8 and was already marked as verified at the original 2026-08-12 pass and the Reviewer Gate re-pass — out of scope per task instructions, not re-checked here.
- `package.json` cross-check: installed versions (`next@16.3.0`, `react@19.2.8`, `@prisma/client@7.9.1`, `@modelcontextprotocol/client@^2.0.0`) are all consistent with what the Stack table claims (`16.3.x`, `19.2`, `7.x`, `^2.0.0`) — no drift between the spine's claims and what's actually installed.

## Things flagged, not fixed (per task scope — spine not edited)

- **AD-7's `[OPEN]` item is real and still open**: the live YouTrack MCP server's actual tool list (read vs. write split) has not been enumerated against a running server — the spine already says this explicitly and defers it to pre-implementation. This review does not change that status; it's a genuine "not yet checked against reality" gap, correctly labeled as such in the source document rather than silently assumed.
- **AD-8's model choice `[ASSUMPTION]`** is likewise correctly labeled open, not silently stale — Haiku 4.5 is a valid, current candidate, but PM sign-off is still pending per the spine's own text.
