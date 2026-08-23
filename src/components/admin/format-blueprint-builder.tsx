"use client";

import { useEffect, useState } from "react";
import { StageGraphEditor } from "@/components/admin/stage-graph-editor";
import {
  createDefaultFormatBlueprint,
  normalizeFormatBlueprint,
  stringifyFormatBlueprint,
  type FormatBlueprint,
} from "@/lib/format-blueprint";
import { getDraftFormatBlueprint, type TournamentBuilderDraft } from "@/lib/tournaments/tournament-builder-draft";

function createVisualBlueprint(value?: FormatBlueprint | null): FormatBlueprint {
  const blueprint = normalizeFormatBlueprint(value ?? createDefaultFormatBlueprint());

  return {
    ...blueprint,
    stageGraph: blueprint.stageGraph ? { ...blueprint.stageGraph, mode: "VISUAL" } : undefined,
  };
}

export function FormatBlueprintBuilder({
  name,
  initialValue,
  visible,
  restoredDraft,
}: {
  name: string;
  initialValue?: FormatBlueprint | null;
  visible: boolean;
  restoredDraft?: TournamentBuilderDraft | null;
}) {
  const [blueprint, setBlueprint] = useState<FormatBlueprint>(() => createVisualBlueprint(initialValue));

  useEffect(() => {
    const restoredBlueprint = getDraftFormatBlueprint(restoredDraft ?? null);
    setBlueprint(createVisualBlueprint(restoredBlueprint ?? initialValue));
  }, [initialValue, restoredDraft]);

  if (!visible) {
    return <input type="hidden" name={name} value="" />;
  }

  return (
    <div className="min-w-0">
      <input type="hidden" name={name} value={stringifyFormatBlueprint(blueprint)} />
      {blueprint.stageGraph ? (
        <StageGraphEditor
          value={blueprint.stageGraph}
          onChange={(stageGraph) =>
            setBlueprint((current) => ({
              ...current,
              stageGraph: { ...stageGraph, mode: "VISUAL" },
            }))
          }
        />
      ) : null}
    </div>
  );
}
