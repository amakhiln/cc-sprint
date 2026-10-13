// Split out from route.ts so route.selfcheck.ts can import it directly via
// plain `node` without going through route.ts's other `@/...` imports
// (those only resolve under Next's own bundler, not raw node -- matching
// why every other self-check in this repo only ever imports pure,
// alias-free modules).
import type { AssistantMessage } from "../../../infrastructure/query-assistant/client.ts";

// What the PM has ticked in the chat's pick lists, for "add the selected
// ones". Goes into the system prompt, so only well-formed issue ids (e.g.
// ADM-2145) pass -- never free client text.
const ISSUE_ID = /^[A-Za-z][A-Za-z0-9_]{0,19}-\d{1,9}$/;
const MAX_TICKED = 150;

export function tickedIdsNote(raw: unknown): string {
  const ids = Array.isArray(raw)
    ? Array.from(new Set(raw.filter((id): id is string => typeof id === "string" && ISSUE_ID.test(id)).map((id) => id.toUpperCase()))).slice(0, MAX_TICKED)
    : [];
  return ids.length > 0
    ? `Issues the PM currently has ticked in a pick list: ${ids.join(", ")}.`
    : "The PM has no issues ticked in a pick list right now.";
}

// The client can never smuggle its own "system" message to override the
// real system prompt route.ts sets -- only "user"/"assistant" are accepted.
export function isClientMessage(value: unknown): value is AssistantMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    ((value as { role?: unknown }).role === "user" || (value as { role?: unknown }).role === "assistant") &&
    typeof (value as { content?: unknown }).content === "string"
  );
}
