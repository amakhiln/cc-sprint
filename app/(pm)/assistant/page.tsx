import { Plug } from "lucide-react";
import { youTrackMcpConfigRepository } from "@/infrastructure/youtrack-mcp/config";
import { AssistantChat } from "./assistant-chat";

export default async function AssistantPage() {
  const mcpConfig = await youTrackMcpConfigRepository.get();

  return (
    // Full-height chat page: the page itself scrolls (no inner scroll box);
    // 5rem ~ the sticky TopNav plus its margin.
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-6xl flex-col px-4 sm:px-6">
      <h1 id="assistant-heading" tabIndex={-1} className="sr-only">
        Assistant
      </h1>

      {mcpConfig ? (
        <AssistantChat />
      ) : (
        // Mirrors app/(pm)/settings/page.tsx's not-connected empty state.
        <section className="glass p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-glass)]"
            >
              <Plug className="size-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-heading text-foreground">Not connected</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Set YOUTRACK_MCP_SERVER_URL, YOUTRACK_MCP_PROJECT_ID, and YOUTRACK_MCP_AUTH_TOKEN to ask the assistant about your
                project data.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
