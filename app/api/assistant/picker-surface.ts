// Builds the A2UI v0.9 message list for the assistant's issue picker. Pure:
// every row is built from real YouTrack issue data by app code -- the model
// only ever picked which ids to show (Story 5.2 grounding stance).
import { hasPullableEstimate, type YouTrackIssueSummary } from "../../../domain/youtrack.ts";

// basicCatalog.id from @a2ui/react/v0_9 -- a literal here so this server
// module never imports the client-only renderer. picker-surface.selfcheck.ts
// asserts it still matches.
export const BASIC_CATALOG_ID = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";

export const ADD_TO_SPRINT_EVENT = "add_to_sprint";

export type PickerSurface = { surfaceId: string; messages: unknown[] };

function label(issue: YouTrackIssueSummary): string {
  const estimate = issue.estimateHours !== null && issue.estimateHours > 0 ? `${issue.estimateHours.toFixed(1)}h` : "no estimate";
  return [issue.id, issue.summary, issue.type ?? "No type", estimate].join(" · ");
}

export function buildPickerSurface(
  surfaceId: string,
  issues: YouTrackIssueSummary[],
  { preselect, hasActiveSprint }: { preselect: boolean; hasActiveSprint: boolean },
): PickerSurface {
  const addable = issues.filter(hasPullableEstimate);
  const needsEstimate = issues.filter((issue) => !hasPullableEstimate(issue));

  const components: Record<string, unknown>[] = [];
  const rootChildren: string[] = [];
  const add = (component: Record<string, unknown>, inRoot = true) => {
    components.push(component);
    if (inRoot) rootChildren.push(component.id as string);
  };

  if (addable.length > 0) {
    add({ id: "title", component: "Text", variant: "h5", text: `${addable.length} ${addable.length === 1 ? "issue" : "issues"} ready to add` });
    add({ id: "list", component: "List", children: { path: "/issues", componentId: "row" } });
    add({ id: "row", component: "CheckBox", label: { path: "label" }, value: { path: "selected" } }, false);
  }
  if (needsEstimate.length > 0) {
    add({ id: "needs_title", component: "Text", variant: "caption", text: "Needs an estimate in YouTrack before it can be added:" });
    add({ id: "needs_list", component: "List", children: { path: "/needsEstimate", componentId: "needs_row" } });
    add({ id: "needs_row", component: "Text", variant: "caption", text: { path: "label" } }, false);
  }
  if (addable.length > 0) {
    if (!hasActiveSprint) {
      add({ id: "no_sprint", component: "Text", variant: "caption", text: "No active Sprint — start one to add issues." });
    }
    add({
      id: "add",
      component: "Button",
      variant: "primary",
      child: "add_label",
      action: { event: { name: ADD_TO_SPRINT_EVENT, context: { issues: { path: "/issues" } } } },
      // CheckBox/Button have no disabled prop -- a failing check is the
      // basic catalog's only way to disable the button.
      ...(hasActiveSprint ? {} : { checks: [{ condition: false, message: "No active Sprint" }] }),
    });
    add({ id: "add_label", component: "Text", variant: "h5", text: "Add to sprint" }, false);
  }
  components.unshift({ id: "root", component: "Column", children: rootChildren });

  return {
    surfaceId,
    messages: [
      { version: "v0.9", createSurface: { surfaceId, catalogId: BASIC_CATALOG_ID } },
      { version: "v0.9", updateComponents: { surfaceId, components } },
      {
        version: "v0.9",
        updateDataModel: {
          surfaceId,
          path: "/",
          value: {
            issues: addable.map((issue) => ({ id: issue.id, label: label(issue), selected: preselect })),
            needsEstimate: needsEstimate.map((issue) => ({ id: issue.id, label: label(issue) })),
          },
        },
      },
    ],
  };
}

// The Add action's resolved `context.issues` -> the ids the PM actually
// ticked. Anything not a well-formed, selected row is ignored, so an unticked
// row can never reach the Add action.
export function tickedIssueIds(contextIssues: unknown): string[] {
  if (!Array.isArray(contextIssues)) return [];
  return contextIssues
    .filter((row) => row !== null && typeof row === "object" && (row as { selected?: unknown }).selected === true)
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string");
}
