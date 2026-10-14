// Runnable self-check for help.ts -- which questions count as a help
// request, and that the guide surface is a well-formed A2UI tree whose every
// example asks a real question. Run with:
//   node app/api/assistant/help.selfcheck.ts
import assert from "node:assert/strict";
import { ASK_EVENT, HELP_STAGES, buildHelpSurface, isHelpRequest } from "./help.ts";

// HELP_INTENT -- the screenshot's question and its common phrasings.
for (const question of [
  "what all things you can do to help me in sprint planning",
  "What can you do?",
  "how can you help me with sprint planning?",
  "help",
  "What are you able to do",
  "what kind of questions can I ask",
  "Show me your capabilities",
]) {
  assert.ok(isHelpRequest(question), question);
}
// Real questions that merely mention help go to the model.
for (const question of [
  "help me find bugs assigned to me",
  "Show unresolved bugs assigned to me",
  "can you help with ADM-2151",
  "Who is over-allocated this sprint?",
]) {
  assert.ok(!isHelpRequest(question), question);
}

// SURFACE -- unique ids, every reference resolves, one tab per stage, and
// every Button asks a non-empty question that appears in HELP_STAGES.
const surface = buildHelpSurface("help-test");
const update = surface.messages[1] as { updateComponents: { components: Record<string, unknown>[] } };
const components = update.updateComponents.components as ({ id: string; component: string } & Record<string, unknown>)[];
const byId = new Map(components.map((component) => [component.id, component]));
assert.equal(byId.size, components.length, "component ids are unique");
assert.ok(byId.has("root"));
for (const component of components) {
  const refs = [
    ...((component.children as string[] | undefined) ?? []),
    ...(typeof component.child === "string" ? [component.child] : []),
    ...(((component.tabs as { child: string }[] | undefined) ?? []).map((tab) => tab.child)),
  ];
  for (const ref of refs) assert.ok(byId.has(ref), `${component.id} -> ${ref}`);
}
const tabs = components.find((component) => component.component === "Tabs")!.tabs as { title: string }[];
assert.deepEqual(tabs.map((tab) => tab.title), HELP_STAGES.map((stage) => stage.label));
const allPrompts = HELP_STAGES.flatMap((stage) => stage.capabilities.flatMap((capability) => capability.prompts));
const buttons = components.filter((component) => component.component === "Button");
assert.equal(buttons.length, allPrompts.length);
for (const button of buttons) {
  const event = (button.action as { event: { name: string; context: { question: string } } }).event;
  assert.equal(event.name, ASK_EVENT);
  assert.ok(allPrompts.includes(event.context.question));
}

console.log("help.selfcheck: all assertions passed");
