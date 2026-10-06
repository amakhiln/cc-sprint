// Runnable self-check: the picker's A2UI messages are accepted by the real
// v0.9 MessageProcessor, unestimated issues never become checkboxes, and the
// Add button's action resolves the ticked rows. Run with:
//   node app/api/assistant/picker-surface.selfcheck.ts
import assert from "node:assert/strict";
import { basicCatalog } from "@a2ui/react/v0_9";
import { ComponentContext, MessageProcessor, type ActionPayload } from "@a2ui/web_core/v0_9";
import { BASIC_CATALOG_ID, buildPickerSurface, tickedIssueIds } from "./picker-surface.ts";

const mk = (id: string, estimateHours: number | null) => ({
  id, summary: `Issue ${id}`, type: "Sub-task", estimateHours, assignee: null, priority: null, state: null,
});

assert.equal(basicCatalog.id, BASIC_CATALOG_ID);

{
  const surface = buildPickerSurface("s1", [mk("P-1", 3), mk("P-2", null), mk("P-3", 0), mk("P-4", 1.5)], {
    preselect: true,
    hasActiveSprint: true,
  });
  let action: ActionPayload | null = null;
  const processor = new MessageProcessor([basicCatalog], (a) => { action = a; });
  processor.processMessages(surface.messages as never);
  const model = processor.getSurface("s1");
  assert.ok(model, "surface created");
  const data = model.dataModel.get("/") as { issues: { id: string; selected: boolean }[]; needsEstimate: { id: string }[] };
  assert.deepEqual(data.issues.map((i) => i.id), ["P-1", "P-4"]);
  assert.ok(data.issues.every((i) => i.selected));
  assert.deepEqual(data.needsEstimate.map((i) => i.id), ["P-2", "P-3"]);

  const button = (surface.messages[1] as { updateComponents: { components: { id: string; checks?: unknown }[] } })
    .updateComponents.components.find((c) => c.id === "add");
  assert.ok(button && !button.checks, "enabled with an active Sprint");

  // Same path the Button takes: resolve the action against the data model,
  // then dispatch.
  const ctx = new ComponentContext(model, "add");
  const raw = model.componentsModel.get("add")!.properties.action as Parameters<typeof ctx.dataContext.resolveAction>[0];
  await ctx.dispatchAction(ctx.dataContext.resolveAction(raw) as never);
  const resolved = (action as ActionPayload | null)?.context.issues as { id: string }[];
  assert.deepEqual(resolved.map((i) => i.id), ["P-1", "P-4"]);
}

{
  const surface = buildPickerSurface("s2", [mk("P-1", 3)], { preselect: false, hasActiveSprint: false });
  const components = (surface.messages[1] as { updateComponents: { components: { id: string; checks?: unknown }[] } })
    .updateComponents.components;
  assert.ok(components.find((c) => c.id === "add")?.checks, "Add disabled without an active Sprint");
  assert.ok(components.some((c) => c.id === "no_sprint"));
  new MessageProcessor([basicCatalog]).processMessages(surface.messages as never);
}

// Only ticked, well-formed rows reach the Add action.
assert.deepEqual(
  tickedIssueIds([
    { id: "P-1", selected: true },
    { id: "P-2", selected: false },
    { id: "P-3" },
    { id: 7, selected: true },
    null,
    { id: "P-4", selected: true },
  ]),
  ["P-1", "P-4"],
);
assert.deepEqual(tickedIssueIds([{ id: "P-1", selected: false }]), []);
assert.deepEqual(tickedIssueIds(undefined), []);

console.log("picker-surface.selfcheck: all assertions passed");
