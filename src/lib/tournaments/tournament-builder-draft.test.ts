import assert from "node:assert/strict";
import test from "node:test";
import { createTournamentBuilderDraft, getDraftFormatBlueprint, parseTournamentBuilderDraft } from "@/lib/tournaments/tournament-builder-draft";

test("creation draft preserves repeated fields and the complete visual graph", () => {
  const data = new FormData();
  data.set("title", "Европейский клубный сезон");
  data.append("sortRules", "POINTS");
  data.append("sortRules", "WINS");
  data.set("formatBlueprintJson", JSON.stringify({ stageGraph: { mode: "VISUAL", stages: [{ id: "national", name: "Национальные лиги" }] } }));

  const restored = parseTournamentBuilderDraft(JSON.stringify(createTournamentBuilderDraft(data)));

  assert.deepEqual(restored?.fields.sortRules, ["POINTS", "WINS"]);
  assert.equal(getDraftFormatBlueprint(restored)?.stageGraph?.stages[0]?.name, "Национальные лиги");
});

test("invalid session data is ignored", () => {
  assert.equal(parseTournamentBuilderDraft("not-json"), null);
  assert.equal(parseTournamentBuilderDraft(JSON.stringify({ fields: [] })), null);
});
