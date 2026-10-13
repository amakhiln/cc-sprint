// Runnable self-check: the picker is a ResultTable in selection mode that the
// real v0.9 MessageProcessor accepts, unestimated issues are never pickable,
// and an Add dispatched through A2UI's own action path reaches onAction with
// the picked ids. Run with:
//   node app/api/assistant/picker-surface.selfcheck.ts
import assert from "node:assert/strict";
import { Catalog, ComponentContext, MessageProcessor, type ActionPayload } from "@a2ui/web_core/v0_9";
import { ADD_TO_SPRINT_EVENT, buildPickerSurface, pickedIssueIds } from "./picker-surface.ts";
import { APP_CATALOG_ID, ResultTableApi, type ResultTableProps } from "./result-surface.ts";

const mk = (id: string, estimateHours: number | null) => ({
  id, summary: `Issue ${id}`, type: "Sub-task", estimateHours, assignee: null, priority: null, state: "Open",
});
const catalog = new Catalog(APP_CATALOG_ID, "0.9", [ResultTableApi]);

{
  const surface = buildPickerSurface("s1", [mk("P-1", 3), mk("P-2", null), mk("P-3", 0), mk("P-4", 1.5)], {
    preselect: true,
    hasActiveSprint: true,
  });
  let action: ActionPayload | null = null;
  const processor = new MessageProcessor([catalog], (a) => { action = a; });
  processor.processMessages(surface.messages as never);
  const model = processor.getSurface("s1");
  assert.ok(model, "surface created");
  const props = model.componentsModel.get("root")!.properties as ResultTableProps;
  assert.equal(props.title, "2 issues ready to add · 2 need an estimate");
  // Addable first; unestimated rows visible but disabled.
  assert.deepEqual(props.rows.map((r) => [r.id, !!r.disabledReason]), [["P-1", false], ["P-4", false], ["P-2", true], ["P-3", true]]);
  assert.deepEqual(props.rows[0].cells, ["P-1", "Issue P-1", "Sub-task", "Open", "", "3.0"]);
  assert.deepEqual(props.select, { event: ADD_TO_SPRINT_EVENT, buttonLabel: "Add to sprint", preselect: true });

  // Same call ResultTable's button makes.
  await new ComponentContext(model, "root").dispatchAction({ event: { name: ADD_TO_SPRINT_EVENT, context: { ids: ["P-1", "P-4"] } } });
  const got = action as ActionPayload | null;
  assert.equal(got?.name, ADD_TO_SPRINT_EVENT);
  assert.deepEqual(pickedIssueIds(got?.context.ids), ["P-1", "P-4"]);
}

{
  const surface = buildPickerSurface("s2", [mk("P-1", 3)], { preselect: false, hasActiveSprint: false });
  const processor = new MessageProcessor([catalog]);
  processor.processMessages(surface.messages as never);
  const props = processor.getSurface("s2")!.componentsModel.get("root")!.properties as ResultTableProps;
  assert.ok(props.select?.blockedReason, "Add blocked without an active Sprint");
  assert.equal(props.select?.preselect, false);
}

// Only string ids reach the Add action.
assert.deepEqual(pickedIssueIds(["P-1", 7, null, "P-2"]), ["P-1", "P-2"]);
assert.deepEqual(pickedIssueIds(undefined), []);

console.log("picker-surface self-check passed");
