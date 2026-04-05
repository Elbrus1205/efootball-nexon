import { PlayoffType } from "@prisma/client";

export type PlayoffTargetBracket = "upper" | "lower";

export type PlayoffSelectionRule = {
  id: string;
  divisionIndex: number;
  fromRank: number;
  toRank: number;
  targetBracket: PlayoffTargetBracket;
};

export type PlayoffStageBlueprint = {
  id: string;
  name: string;
  type: PlayoffType;
  legsCount: number;
  thirdPlaceMatch: boolean;
  selections: PlayoffSelectionRule[];
};

export type FormatBlueprint = {
  leagueStageName: string;
  divisionsCount: number;
  playoffs: PlayoffStageBlueprint[];
};

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultPlayoffSelection(partial?: Partial<PlayoffSelectionRule>): PlayoffSelectionRule {
  return {
    id: partial?.id ?? randomId("selection"),
    divisionIndex: Math.max(1, partial?.divisionIndex ?? 1),
    fromRank: Math.max(1, partial?.fromRank ?? 1),
    toRank: Math.max(partial?.fromRank ?? 1, partial?.toRank ?? partial?.fromRank ?? 1),
    targetBracket: partial?.targetBracket ?? "upper",
  };
}

export function createDefaultPlayoffStage(partial?: Partial<PlayoffStageBlueprint>): PlayoffStageBlueprint {
  const type = partial?.type ?? PlayoffType.SINGLE;

  return {
    id: partial?.id ?? randomId("playoff"),
    name: partial?.name?.trim() || "Плей-офф",
    type,
    legsCount: Math.max(1, Math.min(2, partial?.legsCount ?? 1)),
    thirdPlaceMatch: Boolean(partial?.thirdPlaceMatch),
    selections:
      partial?.selections?.map((selection) =>
        createDefaultPlayoffSelection({
          ...selection,
          targetBracket: type === PlayoffType.SINGLE ? "upper" : selection.targetBracket,
        }),
      ) ?? [createDefaultPlayoffSelection()],
  };
}

export function createDefaultFormatBlueprint(): FormatBlueprint {
  return {
    leagueStageName: "Лиги",
    divisionsCount: 3,
    playoffs: [
      createDefaultPlayoffStage({
        name: "Основной плей-офф",
        type: PlayoffType.DOUBLE,
        legsCount: 1,
        thirdPlaceMatch: false,
        selections: [
          createDefaultPlayoffSelection({ divisionIndex: 1, fromRank: 1, toRank: 6, targetBracket: "upper" }),
          createDefaultPlayoffSelection({ divisionIndex: 2, fromRank: 1, toRank: 5, targetBracket: "upper" }),
          createDefaultPlayoffSelection({ divisionIndex: 3, fromRank: 1, toRank: 5, targetBracket: "upper" }),
          createDefaultPlayoffSelection({ divisionIndex: 1, fromRank: 7, toRank: 11, targetBracket: "lower" }),
          createDefaultPlayoffSelection({ divisionIndex: 2, fromRank: 6, toRank: 10, targetBracket: "lower" }),
          createDefaultPlayoffSelection({ divisionIndex: 3, fromRank: 6, toRank: 10, targetBracket: "lower" }),
        ],
      }),
    ],
  };
}

export function normalizeFormatBlueprint(input: unknown): FormatBlueprint {
  if (!input || typeof input !== "object") {
    return createDefaultFormatBlueprint();
  }

  const value = input as Partial<FormatBlueprint>;
  const leagueStageName = value.leagueStageName?.trim() || "Лиги";
  const divisionsCount = Math.max(1, Math.min(8, Number(value.divisionsCount ?? 1) || 1));
  const playoffs =
    value.playoffs && Array.isArray(value.playoffs) && value.playoffs.length
      ? value.playoffs.map((playoff) => createDefaultPlayoffStage(playoff))
      : createDefaultFormatBlueprint().playoffs;

  return {
    leagueStageName,
    divisionsCount,
    playoffs,
  };
}

export function parseFormatBlueprintJson(input: string | null | undefined) {
  if (!input?.trim()) {
    return null;
  }

  try {
    return normalizeFormatBlueprint(JSON.parse(input));
  } catch {
    return null;
  }
}

export function stringifyFormatBlueprint(input: FormatBlueprint) {
  return JSON.stringify(normalizeFormatBlueprint(input));
}
