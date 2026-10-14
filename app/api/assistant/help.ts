// The Assistant's help guide: what it can do, organised by Sprint stage, as
// one A2UI v0.9 surface built from the standard component vocabulary
// (Column/Row/Text/Button/Tabs/Divider -- rendered app-styled by
// app/(pm)/assistant/a2ui-components.tsx). Each example is a Button whose
// action asks that question in the chat. Pure and client-safe: the empty
// state, the help panel, the route's fast path and the show_help tool all
// render this one source -- keep it in step with what the tools can answer.
import type { A2uiSurfaceMessages } from "./result-surface.ts";
import { APP_CATALOG_ID } from "./result-surface.ts";

export const ASK_EVENT = "ask";

type Capability = { title: string; detail: string; prompts: string[] };
type Stage = { id: string; label: string; summary: string; capabilities: Capability[] };

export const HELP_STAGES: Stage[] = [
  {
    id: "plan",
    label: "Plan",
    summary: "Size the Sprint against real capacity and pull the right work in.",
    capabilities: [
      {
        title: "Check capacity",
        detail: "Team and per-person hours after leave and holidays, and how much is already planned.",
        prompts: ["Do we have room for more work?", "Who is over-allocated this sprint?"],
      },
      {
        title: "Fill to capacity",
        detail: "Backlog issues that fit the hours left — priority first, pre-ticked for you to add.",
        prompts: ["Fill the sprint to 85%, bugs first", "What fits in the remaining capacity?"],
      },
      {
        title: "Pull from the backlog",
        detail: "Filter pullable issues by type and estimate, tick the ones you want, then add them.",
        prompts: ["Show pullable tasks with estimates", "Add the selected issues to the sprint"],
      },
    ],
  },
  {
    id: "refine",
    label: "Refine",
    summary: "Get backlog issues ready before they reach planning.",
    capabilities: [
      {
        title: "Find what isn't ready",
        detail: "Issues that still need an estimate before they can join a Sprint.",
        prompts: ["Show sub-tasks without estimates", "Which backlog bugs need an estimate?"],
      },
      {
        title: "Settle the scope",
        detail: "Read an issue in full, with its comments, before you size it.",
        prompts: ["Summarize ADM-2151 and its comments"],
      },
    ],
  },
  {
    id: "track",
    label: "Track",
    summary: "See where the running Sprint stands, day to day.",
    capabilities: [
      {
        title: "Burndown and overruns",
        detail: "Remaining hours against the ideal line, and issues logged past their estimate.",
        prompts: ["Are we behind on the burndown?", "Which issues have run over their estimate?"],
      },
      {
        title: "Who's around",
        detail: "Planned and emergency leave plus company holidays, for any dates.",
        prompts: ["Who's on leave next week?", "Any holidays during this sprint?"],
      },
    ],
  },
  {
    id: "review",
    label: "Review & retro",
    summary: "Look back with the numbers, not memory.",
    capabilities: [
      {
        title: "Velocity",
        detail: "Planned against actual hours for each closed Sprint, and the trend.",
        prompts: ["How has velocity trended?", "How did last sprint compare with plan?"],
      },
      {
        title: "Estimate accuracy",
        detail: "Estimated against logged hours per issue and per person this Sprint.",
        prompts: ["Who logged more than estimated this sprint?"],
      },
    ],
  },
  {
    id: "lookup",
    label: "Look up",
    summary: "Search YouTrack without leaving the plan.",
    capabilities: [
      {
        title: "Issues",
        detail: "Search and filter issues, or catch up on one and its comments.",
        prompts: ["Show unresolved bugs assigned to me", "Which issues were updated in the last 7 days?"],
      },
      {
        title: "People and docs",
        detail: "Users, groups and who's in them, and knowledge-base articles.",
        prompts: ["Which user groups exist, and who is in each?", "Find articles about deployment"],
      },
    ],
  },
];

export const HELP_LIMITS = [
  "Read-only on YouTrack — it can't create or edit issues, comment, or log work.",
  "Nothing joins the Sprint until you click Add to sprint.",
  "Lists show up to 50 rows; velocity covers the latest 12 closed Sprints.",
  "Forgets the conversation when you reload the page.",
];

export const HELP_INTRO = "Here's how I can help across the Sprint — pick a stage, then tap a question to run it.";

// "what can you do", "how can you help me in sprint planning", "help", ...
// Deliberately narrow: a real question that merely mentions "help" ("help me
// find bugs assigned to me") must still go to the model.
const HELP_PATTERNS = [
  /^\s*(help|\?|what can i ask\??|capabilities|commands)\s*[.!?]*\s*$/i,
  /\bwhat\s+(all\s+)?(things\s+|else\s+)?(can\s+you|could\s+you|do\s+you|you\s+can|you\s+could)\s+(do|help|offer)\b/i,
  /\bhow\s+(can|could|do|would)\s+you\s+help\b/i,
  /\bwhat\s+are\s+you\s+(able|capable)\b/i,
  /\b(your|the assistant'?s?)\s+(capabilities|features|abilities)\b/i,
  /\bwhat\s+(kind\s+of\s+)?(questions|things)\s+can\s+i\s+ask\b/i,
];

export function isHelpRequest(question: string): boolean {
  return question.length <= 160 && HELP_PATTERNS.some((pattern) => pattern.test(question));
}

type Component = { id: string; component: string } & Record<string, unknown>;

// One A2UI surface: a heading, a tab per Sprint stage, and the limits.
export function buildHelpSurface(surfaceId: string): A2uiSurfaceMessages {
  const components: Component[] = [];
  const add = (component: Component) => (components.push(component), component.id);
  const text = (id: string, value: string, variant: string) => add({ id, component: "Text", text: value, variant });

  const tabs = HELP_STAGES.map((stage) => {
    const children = [text(`${stage.id}-summary`, stage.summary, "body")];
    stage.capabilities.forEach((capability, c) => {
      const key = `${stage.id}-${c}`;
      const prompts = capability.prompts.map((question, p) =>
        add({
          id: `${key}-ask-${p}`,
          component: "Button",
          child: text(`${key}-ask-${p}-label`, question, "body"),
          action: { event: { name: ASK_EVENT, context: { question } } },
          accessibility: { label: `Ask: ${question}` },
        }),
      );
      if (c > 0) children.push(add({ id: `${key}-rule`, component: "Divider" }));
      children.push(
        add({
          id: key,
          component: "Column",
          children: [
            text(`${key}-title`, capability.title, "h5"),
            text(`${key}-detail`, capability.detail, "caption"),
            add({ id: `${key}-prompts`, component: "Row", children: prompts }),
          ],
        }),
      );
    });
    return { title: stage.label, child: add({ id: `stage-${stage.id}`, component: "Column", children }) };
  });

  add({
    id: "root",
    component: "Column",
    children: [
      add({
        id: "header",
        component: "Column",
        children: [
          text("title", "What I can do for your Sprint", "h4"),
          text("subtitle", "Pick a stage, then tap a question — I'll run it on live data.", "caption"),
        ],
      }),
      add({ id: "stages", component: "Tabs", tabs }),
      add({ id: "limits-rule", component: "Divider" }),
      text("limits", HELP_LIMITS.join(" · "), "caption"),
    ],
  });

  return {
    surfaceId,
    messages: [
      { version: "v0.9", createSurface: { surfaceId, catalogId: APP_CATALOG_ID } },
      { version: "v0.9", updateComponents: { surfaceId, components } },
    ],
  };
}
