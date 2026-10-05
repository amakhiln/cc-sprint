import { Plug } from "lucide-react";
import { youTrackMcpConfigRepository } from "@/infrastructure/youtrack-mcp/config";
import { AssistantChat } from "./assistant-chat";

export default async function AssistantPage() {
  const mcpConfig = await youTrackMcpConfigRepository.get();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-12">
      <div className="mb-8 border-b border-[color:var(--border-glass)] pb-5">
        <h1
          id="assistant-heading"
          tabIndex={-1}
          className="font-heading text-2xl font-medium text-foreground outline-none sm:text-3xl"
        >
          Assistant
        </h1>
      </div>

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
                Set YOUTRACK_MCP_SERVER_URL, YOUTRACK_MCP_PROJECT_ID, and YOUTRACK_MCP_AUTH_TOKEN to ask the assistant about your project data.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
