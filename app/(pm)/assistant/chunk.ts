// The chat's guard for one NDJSON line from /api/assistant. Kept out of
// assistant-chat.tsx so chunk.selfcheck.ts can run it without React.
import type { AssistantChunk } from "../../../infrastructure/query-assistant/client.ts";

export function isAssistantChunk(value: unknown): value is AssistantChunk {
  if (typeof value !== "object" || value === null) return false;
  const chunk = value as Record<string, unknown>;
  switch (chunk.type) {
    case "text":
      return typeof chunk.delta === "string";
    case "source":
      return typeof chunk.label === "string" && typeof chunk.value === "string";
    case "ui":
      return typeof chunk.surface === "object" && chunk.surface !== null;
    case "error":
      return typeof chunk.message === "string";
    default:
      return false;
  }
}
