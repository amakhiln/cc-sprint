import { Plug, PlugZap } from "lucide-react";
import { youTrackConfigRepository } from "@/infrastructure/youtrack/config";
import { youTrackMcpConfigRepository } from "@/infrastructure/youtrack-mcp/config";

export default async function SettingsPage() {
  const config = await youTrackConfigRepository.get();
  const mcpConfig = await youTrackMcpConfigRepository.get();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-12">
      <div className="mb-8 border-b border-[color:var(--border-glass)] pb-5">
        <h1
          id="settings-heading"
          tabIndex={-1}
          className="font-heading text-2xl font-medium text-foreground outline-none sm:text-3xl"
        >
          Settings
        </h1>
      </div>

      {/* Both connections are configured via env vars (YOUTRACK_* /
          YOUTRACK_MCP_*), not editable here -- see .env.example. */}
      <h2 className="mb-4 font-heading text-xl font-medium text-foreground">YouTrack Connection</h2>
      <section className="glass p-6 sm:p-8">
        {config ? (
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(63, 191, 149, 0.16)" }}
            >
              <PlugZap className="size-5 text-[color:var(--accent-mint)]" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-foreground">Connected</p>
              <p className="mt-1 truncate text-sm text-muted-foreground" title={config.instanceUrl}>
                {config.instanceUrl}
              </p>
              <p className="text-sm text-muted-foreground">Project {config.projectId}</p>
            </div>
          </div>
        ) : (
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
                Set YOUTRACK_INSTANCE_URL, YOUTRACK_PROJECT_ID, and YOUTRACK_AUTH_TOKEN and redeploy.
              </p>
            </div>
          </div>
        )}
      </section>

      <h2 className="mt-10 mb-4 font-heading text-xl font-medium text-foreground">
        YouTrack MCP Connection
      </h2>
      <section className="glass p-6 sm:p-8">
        {mcpConfig ? (
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(63, 191, 149, 0.16)" }}
            >
              <PlugZap className="size-5 text-[color:var(--accent-mint)]" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-foreground">Connected</p>
              <p className="mt-1 truncate text-sm text-muted-foreground" title={mcpConfig.serverUrl}>
                {mcpConfig.serverUrl}
              </p>
              <p className="text-sm text-muted-foreground">Project {mcpConfig.projectId}</p>
            </div>
          </div>
        ) : (
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
                Set YOUTRACK_MCP_SERVER_URL, YOUTRACK_MCP_PROJECT_ID, and YOUTRACK_MCP_AUTH_TOKEN and redeploy.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
