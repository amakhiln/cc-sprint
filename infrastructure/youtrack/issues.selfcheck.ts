// Runnable self-check for issues.ts's pure parsing helpers -- no test
// framework installed (see AGENTS.md / project conventions), so this is a
// plain assert-based script. Run with: node infrastructure/youtrack/issues.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.
//
// Fixtures below are the exact shapes returned by a live YouTrack REST API
// call (verified 2026-08-24 against a real project's /api/issues response),
// not fabricated from documentation prose -- see issues.ts's header comment.

import assert from "node:assert/strict";
import { findCustomField, extractFieldName, extractEstimateHours, toIssueSummary, extractSubItems, computeRollups, toWorkLog } from "./issues.ts";

// findCustomField -- the real, only shape REST returns: {name, value}[].

const realCustomFields = [
  { name: "Priority", value: null },
  { name: "Type", value: { name: "Sub-task", $type: "EnumBundleElement" } },
  { name: "Assignees", value: [{ login: "gokul.ganesh", name: "Gokul Ganesh", fullName: "Gokul Ganesh", $type: "User" }] },
  { name: "Estimation", value: { presentation: "2d 2h", minutes: 1080, $type: "PeriodValue" } },
  { name: "Spent time", value: { presentation: "1d 3h", minutes: 660, $type: "PeriodValue" } },
  { name: "State", value: { name: "Backlog", $type: "StateBundleElement" } },
];

assert.deepEqual(
  findCustomField(realCustomFields, ["assignee", "assignees"]),
  [{ login: "gokul.ganesh", name: "Gokul Ganesh", fullName: "Gokul Ganesh", $type: "User" }],
  "should resolve by case-insensitive name match against the real array shape",
);
assert.equal(findCustomField(realCustomFields, ["priority"]), null, "a field present with a null value should return null, not throw");
assert.equal(findCustomField(realCustomFields, ["nonexistent"]), null, "an absent field should return null, not throw");
assert.equal(findCustomField(undefined, ["assignee"]), null, "undefined customFields should return null, not throw");

// extractFieldName

assert.equal(
  extractFieldName([{ login: "gokul.ganesh", name: "Gokul Ganesh", fullName: "Gokul Ganesh" }]),
  "Gokul Ganesh",
  "a multi-value field (this org's 'Assignees') should resolve to its first entry's name",
);
assert.equal(extractFieldName([]), null, "an empty multi-value array should yield null, not throw");
assert.equal(extractFieldName({ name: "Sub-task" }), "Sub-task", "a single enum value should resolve via its name field");
assert.equal(extractFieldName({ login: "ada", fullName: "Ada Lovelace" }), "Ada Lovelace", "fullName should be preferred over login");
assert.equal(extractFieldName(null), null, "null should yield null, not throw");

// extractEstimateHours -- REST always gives {minutes, presentation}, never a
// bare string (that was an MCP-tool-specific quirk, gone with this migration).

assert.equal(
  extractEstimateHours({ presentation: "2d 2h", minutes: 1080 }),
  18,
  "a real Period value should convert via its minutes field (1080/60=18)",
);
assert.equal(extractEstimateHours(null), null, "a null Period value (field not set) should yield null");
assert.equal(extractEstimateHours({ presentation: "2d 2h" }), null, "a Period value missing minutes should yield null, not guess from presentation");

// toIssueSummary -- the real shape end to end.

assert.deepEqual(
  toIssueSummary({
    idReadable: "ADM-1896",
    summary: "Rough Sheet warning popup Api",
    customFields: realCustomFields,
  }),
  {
    id: "ADM-1896",
    summary: "Rough Sheet warning popup Api",
    assignee: "Gokul Ganesh",
    priority: null,
    estimateHours: 18,
    type: "Sub-task",
    state: "Backlog",
  },
  "a real issue payload should map to the expected YouTrackIssueSummary",
);

assert.equal(
  toIssueSummary({ idReadable: "", id: "internal-1", summary: "X", customFields: [] }).id,
  "internal-1",
  "an empty-string idReadable should fall back to the internal id, not be treated as present",
);

// extractSubItems -- link shape confirmed live against ADM-2151's links.

const child = { idReadable: "ADM-2152", summary: "Connect your SecureLoad account", customFields: realCustomFields };
const parent = { idReadable: "ADM-2100", summary: "Parent epic", customFields: [] };
assert.deepEqual(
  extractSubItems([
    { direction: "OUTWARD", linkType: { name: "Subtask" }, issues: [child] },
    { direction: "INWARD", linkType: { name: "Subtask" }, issues: [parent] },
    { direction: "BOTH", linkType: { name: "Relates" }, issues: [parent] },
  ]).map((issue) => issue.id),
  ["ADM-2152"],
  "only OUTWARD Subtask links are children -- INWARD is the parent, other link types are unrelated",
);
assert.deepEqual(extractSubItems(undefined), [], "missing links should yield no sub-items, not throw");

// computeRollups -- Epic > Story > Task > Sub-task, parents' own estimates
// ignored, unset leaf estimates count as 0, a cycle doesn't hang.

assert.deepEqual(
  computeRollups([
    { id: "E", estimateHours: 100, parentId: null },
    { id: "S", estimateHours: 50, parentId: "E" },
    { id: "T1", estimateHours: 20, parentId: "S" },
    { id: "T2", estimateHours: 3, parentId: "S" },
    { id: "ST1", estimateHours: 2, parentId: "T1" },
    { id: "ST2", estimateHours: 1.5, parentId: "T1" },
    { id: "ST3", estimateHours: null, parentId: "T1" },
    { id: "LONE", estimateHours: 8, parentId: null },
    { id: "ORPHAN", estimateHours: 4, parentId: "OTHER-PROJECT-1" },
  ]),
  { E: 6.5, S: 6.5, T1: 3.5 },
  "parents sum their leaves (own estimates ignored); leaves and orphans get no rollup entry",
);
assert.deepEqual(
  computeRollups([
    { id: "A", estimateHours: 1, parentId: "B" },
    { id: "B", estimateHours: 1, parentId: "A" },
  ]),
  { A: 0, B: 0 },
  "a parent/child cycle should terminate, not recurse forever",
);

// toWorkLog -- shape confirmed live against ADM-2172's /api/workItems.

assert.deepEqual(
  toWorkLog({ date: 1790640000000, duration: { minutes: 580 }, issue: { idReadable: "ADM-2172" } }),
  { youtrackIssueId: "ADM-2172", date: new Date("2026-09-29T00:00:00Z"), hours: 580 / 60 },
);
assert.deepEqual(
  toWorkLog({ date: 1790640000000 + 5 * 3600 * 1000, duration: { minutes: 60 }, issue: { idReadable: "ADM-1" } })?.date,
  new Date("2026-09-29T00:00:00Z"),
  "a time-of-day on the date should floor to its UTC day",
);
assert.equal(toWorkLog({ date: 1790640000000, duration: {}, issue: { idReadable: "ADM-1" } }), null, "missing duration -> skipped");

console.log("issues.selfcheck: all assertions passed");
