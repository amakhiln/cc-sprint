// Runnable self-check for the Create Sprint pre-fill's YouTrack side: the
// "board unset" and "YouTrack down / 4xx" rows of the spec's matrix. Plain
// assert script, no framework. Run with: node infrastructure/youtrack/sprints.selfcheck.ts

import assert from "node:assert/strict";
import { getAgileBoardId } from "./config.ts";
import { youTrackSprintsAdapter } from "./sprints.ts";

const config = { instanceUrl: "https://yt.example.com", projectId: "DEMO", authToken: "t" };
const silence = console.error;
console.error = () => {};

// Board unset / blank -> null (pre-fill disabled, manual form).
delete process.env.YOUTRACK_AGILE_BOARD_ID;
assert.equal(getAgileBoardId(), null);
process.env.YOUTRACK_AGILE_BOARD_ID = "  ";
assert.equal(getAgileBoardId(), null);
process.env.YOUTRACK_AGILE_BOARD_ID = " 121-783 ";
assert.equal(getAgileBoardId(), "121-783");

// YouTrack down -> ok:false with the generic message, never a throw.
globalThis.fetch = async () => {
  throw new TypeError("fetch failed");
};
assert.deepEqual(await youTrackSprintsAdapter.listSprints(config, "121-783"), {
  ok: false,
  error: "Couldn't load YouTrack sprints",
});

// 4xx -> same generic failure.
globalThis.fetch = async () => new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
assert.equal((await youTrackSprintsAdapter.listSprints(config, "nope")).ok, false);

// Live response shape -> mapped; id-less rows dropped, missing dates -> null.
globalThis.fetch = async () =>
  new Response(
    JSON.stringify([
      { id: "122-3710", name: "Sprint 22", start: 1792022400000, finish: 1793231999999, archived: false, $type: "Sprint" },
      { name: "no id" },
      { id: "122-1", name: "Undated", archived: true },
    ]),
  );
assert.deepEqual(await youTrackSprintsAdapter.listSprints(config, "121-783"), {
  ok: true,
  data: [
    { id: "122-3710", name: "Sprint 22", start: 1792022400000, finish: 1793231999999, archived: false },
    { id: "122-1", name: "Undated", start: null, finish: null, archived: true },
  ],
});

console.error = silence;
console.log("sprints.selfcheck: all assertions passed");
