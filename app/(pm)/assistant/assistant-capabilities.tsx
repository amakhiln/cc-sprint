import { ListChecks, Users, BookOpen, FolderKanban, Ban } from "lucide-react";

// What the Assistant can actually answer -- one group per slice of the
// read-only YouTrack MCP allowlist (infrastructure/youtrack-mcp/tool-allowlist.ts).
// Keep this in step with that list: never advertise a question no allowed
// tool can answer.
const CAPABILITIES = [
  {
    title: "Issues",
    icon: ListChecks,
    description: "Search and filter issues, read one in full, or catch up on its comments.",
    examples: [
      "Show unresolved bugs assigned to me",
      "Which issues were updated in the last 7 days?",
      "Summarize ADM-2151 and its comments",
      "What saved searches do I have?",
    ],
  },
  {
    title: "People & groups",
    icon: Users,
    description: "Look up users, user groups, and who belongs to them.",
    examples: ["Who am I signed in as?", "Which user groups exist, and who is in each?"],
  },
  {
    title: "Knowledge base",
    icon: BookOpen,
    description: "Search YouTrack articles and read them.",
    examples: ["Find articles about deployment"],
  },
  {
    title: "Projects",
    icon: FolderKanban,
    description: "Project details and the fields an issue can have.",
    examples: ["Which projects can I access?", "What fields and states does an issue have in this project?"],
  },
];

// Stated up front so a question outside these bounds isn't a surprise.
const LIMITS = [
  "Read-only — it can't create or edit issues, change assignees, comment, or log work.",
  "Only sees YouTrack — not this app's Sprints, Capacity, Leave, or Progress figures.",
  "Forgets the conversation when you leave or reload the page.",
];

export function AssistantCapabilities({ onAsk, disabled }: { onAsk: (question: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {CAPABILITIES.map((capability) => (
          <div key={capability.title} className="glass-row flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <capability.icon aria-hidden="true" className="size-4 text-[color:var(--accent-peach)]" />
              <h3 className="font-heading text-sm font-medium text-foreground">{capability.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{capability.description}</p>
            <ul className="flex flex-wrap gap-1.5">
              {capability.examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAsk(example)}
                    className="cursor-pointer rounded-full bg-[color:var(--surface-glass)] px-2.5 py-1 text-left text-xs text-foreground transition-colors hover:bg-[color:var(--surface-glass-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Ban aria-hidden="true" className="size-3.5" />
          What it can&apos;t do
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-9 text-xs text-muted-foreground">
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
