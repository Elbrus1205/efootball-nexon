import { StageType } from "@prisma/client";

export function scheduleRoundTitle(match: {
  round: number;
  bracket?: string | null;
  isThirdPlaceMatch?: boolean;
  stage?: { name: string | null; type?: StageType | null; roundsCount?: number | null } | null;
}) {
  if (match.stage?.type !== StageType.PLAYOFF && match.stage?.type !== StageType.SUPER_CUP) return `${match.round} тур`;
  if (match.isThirdPlaceMatch) return "Матч за 3-е место";
  if (match.bracket === "lower") return `Нижняя сетка · Раунд ${match.round}`;
  if (match.stage.type === StageType.SUPER_CUP) return "Суперкубок";
  if (!match.stage.roundsCount) return `${match.stage.name || "Плей-офф"} · Раунд ${match.round}`;
  const remaining = Math.max(0, match.stage.roundsCount - match.round);
  return remaining === 0 ? "Финал" : `1/${2 ** remaining} финала`;
}

export type ExportScheduleMatch = {
  id: string;
  groupId?: string | null;
  groupName: string | null;
  matchNumber: number;
  player1Id: string | null;
  player2Id: string | null;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
  player1ClubName: string;
  player1ClubBadgePath?: string | null;
  player1Name: string;
  player2ClubName: string;
  player2ClubBadgePath?: string | null;
  player2Name: string;
  isPenaltyTiebreak?: boolean;
  status?: string;
};

export type ExportScheduleRound = {
  key: string;
  title: string;
  deadlineAt: string | null;
  matches: ExportScheduleMatch[];
};

export type SchedulePosterFixture = ExportScheduleMatch & { matchCount: number };

export function schedulePosterRoster(
  side: number,
  lineup: Array<{ side: number; user: { id: string; name: string | null } }>,
  members: Array<{ status: string; user: { id: string; name: string | null } }>,
) {
  const historical = lineup.filter((player) => player.side === side).map((player) => player.user);
  const players = historical.length ? historical : members.filter((member) => member.status === "ACCEPTED").map((member) => member.user);
  if (!players.length) return null;
  const unique = [...new Map(players.map((player) => [player.id, player])).values()];
  return { identity: JSON.stringify(unique.map((player) => player.id).sort()), name: unique.map((player) => player.name?.trim() || "Игрок").join(" / ") };
}

// Called within one stage/round/bracket, never across rounds. Player identity
// preserves separate captain-assigned pairings and historical replacements.
export function schedulePosterFixtures(matches: ExportScheduleMatch[]): SchedulePosterFixture[] {
  const fixtures = new Map<string, SchedulePosterFixture>();
  for (const match of matches) {
    if (match.isPenaltyTiebreak || match.status === "CANCELLED") continue;
    const side1 = [match.participant1EntryId, match.player1Id];
    const side2 = [match.participant2EntryId, match.player2Id];
    const identified = side1.some(Boolean) && side2.some(Boolean);
    const key = identified
      ? JSON.stringify([match.groupId ?? match.groupName, [JSON.stringify(side1), JSON.stringify(side2)].sort()])
      : match.id;
    const previous = fixtures.get(key);
    if (previous) previous.matchCount += 1;
    else fixtures.set(key, { ...match, matchCount: 1 });
  }
  return [...fixtures.values()];
}

export function balancedSchedulePages<T>(items: T[], capacity = 12): T[][] {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Некорректный размер страницы расписания.");
  const count = Math.ceil(items.length / capacity);
  const base = Math.floor(items.length / count);
  const remainder = items.length % count;
  let offset = 0;
  return Array.from({ length: count }, (_, index) => {
    const size = base + (index < remainder ? 1 : 0);
    const page = items.slice(offset, offset + size);
    offset += size;
    return page;
  });
}

export function schedulePosterLayout(count: number) {
  const columns = count > 6 ? 2 : 1;
  const rows = Math.ceil(count / columns);
  const width = 1600;
  const margin = 64;
  const gap = 24;
  const rowHeight = count === 1 ? 560 : count === 2 ? 280 : count === 3 ? 192 : columns === 1 ? 148 : 174;
  const top = 286;
  const height = Math.max(1000, top + rows * (rowHeight + gap) + 48);
  const cardWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
  return {
    width, height, columns, rows,
    slots: Array.from({ length: count }, (_, index) => ({
      // An odd final fixture is centered, so neither column is visually heavy.
      x: columns === 2 && count % 2 === 1 && index === count - 1
        ? (width - cardWidth) / 2
        : margin + (index % columns) * (cardWidth + gap),
      y: top + Math.floor(index / columns) * (rowHeight + gap),
      width: cardWidth,
      height: rowHeight,
    })),
  };
}

export function scheduleDeadlineLabel(value: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "Дедлайн не назначен";
  return `${new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(value))} МСК`;
}

export function scheduleMatchCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return `${count} ${mod10 === 1 && mod100 !== 11 ? "матч" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "матча" : "матчей"}`;
}
