import { PlayoffType } from "@prisma/client";

export type OpeningStageMode = "GROUPS" | "LEAGUE" | "NONE";
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
  openingStageMode: OpeningStageMode;
  divisionsCount: number;
  roundsCount: number;
  participantsPerGroup: number | null;
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
    leagueStageName: "Группы",
    openingStageMode: "GROUPS",
    divisionsCount: 4,
    roundsCount: 1,
    participantsPerGroup: null,
    playoffs: [
      createDefaultPlayoffStage({
        name: "Основной плей-офф",
        type: PlayoffType.DOUBLE,
        legsCount: 1,
        thirdPlaceMatch: false,
        selections: [
          createDefaultPlayoffSelection({ divisionIndex: 1, fromRank: 1, toRank: 2, targetBracket: "upper" }),
          createDefaultPlayoffSelection({ divisionIndex: 2, fromRank: 1, toRank: 2, targetBracket: "upper" }),
          createDefaultPlayoffSelection({ divisionIndex: 3, fromRank: 1, toRank: 2, targetBracket: "upper" }),
          createDefaultPlayoffSelection({ divisionIndex: 4, fromRank: 1, toRank: 2, targetBracket: "upper" }),
          createDefaultPlayoffSelection({ divisionIndex: 1, fromRank: 3, toRank: 4, targetBracket: "lower" }),
          createDefaultPlayoffSelection({ divisionIndex: 2, fromRank: 3, toRank: 4, targetBracket: "lower" }),
          createDefaultPlayoffSelection({ divisionIndex: 3, fromRank: 3, toRank: 4, targetBracket: "lower" }),
          createDefaultPlayoffSelection({ divisionIndex: 4, fromRank: 3, toRank: 4, targetBracket: "lower" }),
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
  const leagueStageName = value.leagueStageName?.trim() || "Группы";
  const openingStageMode: OpeningStageMode =
    value.openingStageMode === "LEAGUE" || value.openingStageMode === "NONE" ? value.openingStageMode : "GROUPS";
  const divisionsCount = openingStageMode === "LEAGUE" ? 1 : Math.max(1, Math.min(16, Number(value.divisionsCount ?? 1) || 1));
  const roundsCount = Math.max(1, Math.min(4, Number(value.roundsCount ?? 1) || 1));
  const participantsPerGroup =
    value.participantsPerGroup === null || value.participantsPerGroup === undefined || value.participantsPerGroup === 0
      ? null
      : Math.max(2, Math.min(32, Number(value.participantsPerGroup) || 2));
  const playoffs =
    value.playoffs && Array.isArray(value.playoffs)
      ? value.playoffs.map((playoff) => createDefaultPlayoffStage(playoff))
      : createDefaultFormatBlueprint().playoffs;
  const normalizedPlayoffs = playoffs.map((playoff) => ({
    ...playoff,
    selections: playoff.selections.map((selection) => {
      const fromRank = Math.max(1, Number(selection.fromRank) || 1);

      return {
        ...selection,
        divisionIndex: Math.max(1, Math.min(divisionsCount, Number(selection.divisionIndex) || 1)),
        fromRank,
        toRank: Math.max(fromRank, Number(selection.toRank) || fromRank),
        targetBracket: playoff.type === PlayoffType.SINGLE ? "upper" : selection.targetBracket,
      };
    }),
  }));

  return {
    leagueStageName,
    openingStageMode,
    divisionsCount,
    roundsCount,
    participantsPerGroup,
    playoffs: openingStageMode === "NONE" && !normalizedPlayoffs.length ? createDefaultFormatBlueprint().playoffs : normalizedPlayoffs,
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
