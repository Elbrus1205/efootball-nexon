import { StageType } from "@prisma/client";
import { buildLeagueTable, type LeagueRow } from "@/lib/tournament-public-view";
import { balancedSchedulePages } from "@/lib/tournaments/schedule-poster";

export type ExportGroupRow = LeagueRow & { rank: number };
export type ExportGroup = {
  id: string;
  name: string;
  stageName: string;
  kind: "groups" | "leagues";
  rows: ExportGroupRow[];
};

type Participant = Parameters<typeof buildLeagueTable>[0][number];
type Match = Parameters<typeof buildLeagueTable>[1][number] & { stageId: string | null; groupId: string | null };
type Stage = Parameters<typeof buildLeagueTable>[3] & {
  id: string;
  name: string;
  type: StageType;
  entries: { registrationId: string; groupId: string | null }[];
  groups: { id: string; name: string; members: { id: string }[] }[];
};

export function buildExportTables(stages: Stage[], participants: Participant[], matches: Match[], clubs: Parameters<typeof buildLeagueTable>[2]): ExportGroup[] {
  return stages.flatMap((stage): ExportGroup[] => {
    if (stage.type !== StageType.GROUP_STAGE && stage.type !== StageType.LEAGUE) return [];
    const stageMatches = matches.filter((match) => match.stageId === stage.id);
    const scopedParticipants = (groupId: string | null, fallback: { id: string }[]) => {
      const entries = stage.entries.filter((entry) => groupId === null || entry.groupId === groupId);
      const ids = new Set(entries.map((entry) => entry.registrationId));
      // Include historical registrations so the shared standings calculation can
      // follow replacement chains. Never borrow players from another league.
      for (const match of stageMatches.filter((match) => groupId === null || match.groupId === groupId)) {
        if (match.participant1EntryId) ids.add(match.participant1EntryId);
        if (match.participant2EntryId) ids.add(match.participant2EntryId);
      }
      for (const member of fallback) ids.add(member.id);
      return participants.filter((entry) => ids.has(entry.id));
    };
    const tables = stage.groups.length
      ? stage.groups.map((group) => ({ id: group.id, name: group.name, participants: scopedParticipants(group.id, group.members), matches: stageMatches.filter((match) => match.groupId === group.id) }))
      : stage.type === StageType.LEAGUE
        ? [{ id: stage.id, name: stage.name, participants: scopedParticipants(null, []), matches: stageMatches }]
        : [];
    return tables.map((table) => ({
      id: table.id,
      name: table.name,
      stageName: stage.name,
      kind: stage.type === StageType.LEAGUE ? "leagues" : "groups",
      rows: buildLeagueTable(table.participants, table.matches, clubs, stage).map((row, index) => ({ ...row, rank: index + 1 })),
    }));
  });
}

export function standingsPosterPages(tables: ExportGroup[]) {
  return tables.flatMap((table) => {
    const pages = table.rows.length ? balancedSchedulePages(table.rows, 12) : [[]];
    return pages.map((rows, index) => ({ table, rows, page: index + 1, pageCount: pages.length }));
  });
}
