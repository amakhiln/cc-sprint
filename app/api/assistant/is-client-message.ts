// Split out from route.ts so route.selfcheck.ts can import it directly via
// plain `node` without going through route.ts's other `@/...` imports
// (those only resolve under Next's own bundler, not raw node -- matching
// why every other self-check in this repo only ever imports pure,
// alias-free modules).
import type { AssistantMessage } from "../../../infrastructure/query-assistant/client.ts";

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
