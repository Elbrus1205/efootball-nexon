import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicTournamentPage = readFileSync(
  new URL("../../app/tournaments/[id]/page.tsx", import.meta.url),
  "utf8",
);

test("public tournament pages do not render the internal stage graph summary", () => {
  assert.doesNotMatch(publicTournamentPage, /StageGraphSummary/);
  assert.doesNotMatch(publicTournamentPage, /describeStageGraphTransition/);
});
