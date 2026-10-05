---
title: 'Ask the Assistant About YouTrack Data'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The PM has a saved, read-only YouTrack MCP connection (Story 5.1) but no way to ask it a natural-language question.

**Approach:** Add a chat page wired to a generic LLM tool-calling loop (Groq, `openai/gpt-oss-120b`) that may only call the Story 5.1 read-only tool registry. A real tool is always called before any figure is stated (standard tool-calling grounding); the model then narrates that real result in its own words.

## Boundaries & Constraints

**Always:**
- A relevant answer is only given after a real tool call returns a real result — the model is instructed to prefer calling a tool over guessing, and to say it can't answer rather than invent a figure when no tool fits.
- Every tool the model is told about is re-validated against `READ_ONLY_TOOL_NAMES` at actual execution time (`callAllowedTool`), not just filtered once when building the tool list.
- `infrastructure/query-assistant/` is fully generic (no YouTrack/MCP-specific types or imports) and is composed with its tools/executor purely by injection from `app/api/assistant/route.ts` — no infra→infra import (AD-8).
- The assistant route (`app/api/assistant/route.ts`) is wired only into `app/(pm)/` — never imported by or reachable from `app/share/[token]/`.
- A tool-call failure, MCP unreachable, or timeout ends the turn with a `{type:"error"}` chunk — never an indefinite hang (bound every network call and the whole request, and cap tool-calling loop iterations).

**Ask First:** none remaining — LLM provider (Groq, `openai/gpt-oss-120b`, free tier, data sent unredacted) was confirmed with the human this session.

**Never:**
- Never let `infrastructure/query-assistant/` import `@modelcontextprotocol/client` or any YouTrack-specific module — it only sees generic tool defs + an injected executor.
- Never persist chat history server-side — client resends the running message list each turn; no new DB model.
- Never build Story 5.3's cross-source (app-domain) blending here — YouTrack-only this story.
- Never build the stricter app-code figure-substitution grounding mechanism here — deferred (see `deferred-work.md`); this story's grounding relies on the model faithfully narrating a real tool result, not on app code substituting the literal value.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Saved MCP config; question answerable via one allowed tool | Model calls the tool, then answers using its real result; a source chunk marks which tool backed the answer | N/A |
| NO_TOOL_ANSWERS | Question no registered tool can answer | Model declines in plain text, no source chunk | N/A |
| NOT_CONFIGURED | No saved `YouTrackMcpConfig` row | Immediate `{type:"error"}`, no LLM call made | Clear inline error, no hang |
| MCP_UNREACHABLE | Saved config, but connect/tool-call fails mid-turn | Loop stops immediately | `{type:"error"}` chunk, never a silent wrong answer |
| LOOP_CAP | Model keeps calling tools without ever finishing | Loop stops at the iteration cap | `{type:"error"}` with a generic "couldn't answer that" message |
| TEAM_VIEW_ISOLATION | Anonymous share-link visitor | No chat entry point, no route reachable | N/A |

</frozen-after-approval>

## Code Map

- `package.json` -- add `groq-sdk` dependency; `.env.example`/`.env` -- add `GROQ_API_KEY`
- `infrastructure/query-assistant/client.ts` (new) -- generic tool-calling loop against Groq's OpenAI-compatible chat-completions API. Exports `AssistantTool {name, description?, parameters}`, `ToolExecutor = (name, args) => Promise<{ok:true,result:unknown}|{ok:false,error:string}>`, `AssistantChunk = {type:"text",delta}|{type:"source",label,value}|{type:"error",message}`, and `runAssistantTurn({apiKey, model, messages, tools, executeTool}): AsyncGenerator<AssistantChunk>`. Loop: send messages+tools (non-streamed); if the response has `tool_calls`, run each via `executeTool`, append `role:"tool"` result messages, emit one `source` chunk per successfully-called tool, loop (cap: 6 iterations); when a response has no `tool_calls`, emit its `content` as one `text` chunk and stop. Zero YouTrack/MCP imports (AD-8).
- `infrastructure/youtrack-mcp/client.ts` -- add `callAllowedTool(config, name, args)`: re-checks `filterToAllowedTools` before connecting, then `connect`→`callTool`→`closeWithTimeout`, returns `{ok,result}|{ok,error}`, never throws. Reuses `newClient`/`closeWithTimeout`/`translateConnectionError`.
- `app/api/assistant/route.ts` (new) -- thin wiring per AD-8: parse `{messages}`, load `youTrackMcpConfigRepository.get()` (error chunk + stop if absent), `getReadOnlyToolRegistry(config)` mapped to `AssistantTool[]` (name/description/`inputSchema`→`parameters`), build the `executeTool` closure over `callAllowedTool(config, ...)`, call `runAssistantTurn(...)`, pipe its chunks into a newline-delimited-JSON `ReadableStream` response. Overall request `AbortSignal.timeout`. System prompt instructs: prefer a tool call over guessing; decline rather than invent a figure.
- `app/(pm)/assistant/page.tsx` (new) -- RSC: if no saved MCP config, show a "connect YouTrack MCP in Settings first" empty state (mirrors `app/(pm)/settings/page.tsx`'s not-connected pattern); otherwise render the chat client component.
- `app/(pm)/assistant/assistant-chat.tsx` (new) -- `"use client"`: message list (role + content + any source lines), input + send, reads the NDJSON response body via `getReader()`, appends `text`/`source` chunks to the in-progress assistant message, renders `error` chunks as `role="alert"`.
- `components/top-nav.tsx:8` -- add `{ href: "/assistant", label: "Assistant", icon: MessageCircle }` to `NAV_ITEMS`.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `.env.example` -- add `groq-sdk` + `GROQ_API_KEY` placeholder -- new external dependency
- [x] `infrastructure/query-assistant/client.ts` -- generic tool-calling loop, iteration cap, source-chunk emission
- [x] `infrastructure/query-assistant/client.selfcheck.ts` -- fake Groq responses (no network) covering: happy-path tool-call-then-answer, no-tool-needed decline, iteration cap reached
- [x] `infrastructure/youtrack-mcp/client.ts` -- add `callAllowedTool` -- re-validated execution boundary
- [x] `infrastructure/youtrack-mcp/client.selfcheck.ts` -- extend: `callAllowedTool` rejects an unlisted tool name before ever connecting
- [x] `app/api/assistant/route.ts` -- wiring + NDJSON streaming response -- AD-8's "wiring stays at the app/ layer"
- [x] `app/(pm)/assistant/page.tsx`, `assistant-chat.tsx` -- chat UI
- [x] `components/top-nav.tsx` -- nav entry

**Acceptance Criteria:**
- Given a saved MCP connection and a question answerable by an allowed tool, when the assistant answers, then a real tool was called first and a source chunk marks the answer as YouTrack-backed
- Given a question no registered tool can answer, when the assistant responds, then it says so rather than guessing
- Given the MCP server is unreachable or a tool call times out, when I ask a question needing it, then I see a clear inline error, never a silent wrong answer or a hang
- Given I am on the anonymous Team View share link, when I look for the assistant, then no entry point or route exists there

## Spec Change Log

## Design Notes

**Grounding strategy for this story (narrowed scope):** standard tool-calling — the model sees a real tool's JSON result and narrates it, rather than app code substituting the literal figure from a citation. This closes the primary hallucination risk (answering with zero grounding) but doesn't structurally rule out the model transcribing a seen number wrong. The stricter app-code substitution mechanism (AD-8's letter) is deferred — see `deferred-work.md` — after the full design was scoped and found to push this spec well over its token target; the human chose the simpler version now.

**Groq/data note (confirmed with the human this session):** free tier, `openai/gpt-oss-120b`, no confirmed no-training guarantee (unlike Anthropic's, which the architecture originally assumed) — accepted as low-sensitivity internal team data, not a blocker.

## Verification

**Commands:**
- `node infrastructure/query-assistant/client.selfcheck.ts` -- expected: all assertions pass
- `node infrastructure/youtrack-mcp/client.selfcheck.ts` -- expected: all assertions pass (including the new `callAllowedTool` cases)
- `npx tsc --noEmit` -- expected: clean
- `npm run lint` -- expected: no new errors

**Manual checks (if no CLI):**
- With a real saved MCP connection and `GROQ_API_KEY` set, ask a real question on `/assistant` and confirm a real figure streams in with a YouTrack source line, and an unanswerable question gets a graceful decline instead of a guess.

## Suggested Review Order

**The tool-calling loop — the core of this story**

- Entry point: reads real tool results, never lets a finished-but-empty turn fall through silently.
  [`client.ts:65`](../../infrastructure/query-assistant/client.ts#L65)

- Real-SDK-shape mapping, pulled out as a pure function so it's actually testable.
  [`client.ts:134`](../../infrastructure/query-assistant/client.ts#L134)

- The only place `groq-sdk` is touched — thin, injects the generic loop above.
  [`client.ts:148`](../../infrastructure/query-assistant/client.ts#L148)

**The re-validated execution boundary (AD-7 carried into Story 5.2)**

- Re-checks the allowlist at actual call time, not just when the tool list was built.
  [`client.ts:157`](../../infrastructure/youtrack-mcp/client.ts#L157)

**Wiring & request-boundary hardening (AD-8: composition stays at the app/ layer)**

- Composes the generic loop with the YouTrack-specific tools/executor; every early-exit path returns the same ndjson error contract.
  [`route.ts:50`](../../app/api/assistant/route.ts#L50)

- The client-can't-smuggle-a-system-message guard, split out so it's unit-testable without Next's bundler.
  [`is-client-message.ts:10`](../../app/api/assistant/is-client-message.ts#L10)

**Chat UI**

- Reads the ndjson stream; `response.ok` check and the tightened chunk-type guard were both review-round additions.
  [`assistant-chat.tsx:22`](../../app/(pm)/assistant/assistant-chat.tsx#L22)

- Empty state gates the chat behind a saved MCP connection, mirroring Settings' own not-connected pattern.
  [`page.tsx:2`](../../app/(pm)/assistant/page.tsx#L2)

- New nav entry.
  [`top-nav.tsx:14`](../../components/top-nav.tsx#L14)

**Tests**

- Loop selfcheck: happy path, no-tool decline, loop cap, tool failure, empty-answer fallback, exact Groq tool-shape mapping.
  [`client.selfcheck.ts:1`](../../infrastructure/query-assistant/client.selfcheck.ts#L1)

- New this review round: the system-message-smuggling guard, tested in isolation.
  [`route.selfcheck.ts:1`](../../app/api/assistant/route.selfcheck.ts#L1)
