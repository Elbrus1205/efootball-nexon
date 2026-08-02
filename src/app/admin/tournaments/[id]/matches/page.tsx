import { ReliabilityPenaltyScope } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft, Swords } from "lucide-react";
import { notFound } from "next/navigation";
import { MatchManager } from "@/components/admin/match-manager";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminTournamentAccessWhere } from "@/lib/admin-tournament-access";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

function getConfiguredMatchPenalty(
  match: { id: string; player1Id: string | null; player2Id: string | null },
  events: Array<{ userId: string; dedupeKey: string | null }>,
) {
  const event = events.find(
    (item) =>
      item.dedupeKey?.startsWith(`match-configured-penalty:${match.id}:`) ||
      item.dedupeKey?.startsWith(`match-score-penalty:${match.id}:`) ||
      item.dedupeKey?.startsWith(`match-forfeit-config:${match.id}:`),
  );
  if (!event?.dedupeKey) return null;

  const [, , , reasonId, selection] = event.dedupeKey.split(":");
  if (!reasonId) return null;

  if (selection === "both") {
    return { reasonId, userIds: [match.player1Id, match.player2Id].filter((userId): userId is string => Boolean(userId)) };
  }

  return { reasonId, userIds: [event.userId] };
}

export default async function AdminTournamentMatchesPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAnyPermission(["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);

  const [tournament, matchPenaltyReasons] = await Promise.all([
    db.tournament.findFirst({
    where: { id: params.id, ...getAdminTournamentAccessWhere(session) },
    select: {
      id: true,
      title: true,
      participants: {
        select: {
          id: true,
          userId: true,
          clubName: true,
          clubSlug: true,
          clubBadgePath: true,
          user: { select: { name: true } },
        },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      matches: {
        select: {
          id: true,
          round: true,
          matchNumber: true,
          status: true,
          scheduledAt: true,
          createdAt: true,
          seriesKey: true,
          legNumber: true,
          player1Score: true,
          player2Score: true,
          player1PenaltyScore: true,
          player2PenaltyScore: true,
          notes: true,
          player1Id: true,
          player2Id: true,
          participant1EntryId: true,
          participant2EntryId: true,
          winnerId: true,
          winnerEntryId: true,
          isPenaltyTiebreak: true,
          seriesWinsRequired: true,
          participant1Entry: { select: { clubName: true, clubSlug: true } },
          participant2Entry: { select: { clubName: true, clubSlug: true } },
          bracketId: true,
          stageId: true,
          player1: { select: { name: true } },
          player2: { select: { name: true } },
          stage: { select: { id: true, name: true, type: true, orderIndex: true } },
          group: { select: { name: true } },
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
    },
    }),
    db.reliabilityPenaltyReason.findMany({
      where: {
        scope: ReliabilityPenaltyScope.SCORE_SUBMISSION,
        isActive: true,
      },
      orderBy: [{ scope: "asc" }, { points: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!tournament) notFound();

  const matchIds = tournament.matches.map((match) => match.id);
  const configuredPenaltyEvents = matchIds.length
    ? await db.reliabilityEvent.findMany({
        where: {
          matchId: { in: matchIds },
          OR: [
            { dedupeKey: { startsWith: "match-configured-penalty:" } },
            { dedupeKey: { startsWith: "match-score-penalty:" } },
            { dedupeKey: { startsWith: "match-forfeit-config:" } },
          ],
        },
        select: {
          id: true,
          userId: true,
          dedupeKey: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const matches = tournament.matches.map((match) => ({
    id: match.id,
    round: match.round,
    matchNumber: match.matchNumber,
    status: match.status,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    createdAt: match.createdAt.toISOString(),
    seriesKey: match.seriesKey,
    legNumber: match.legNumber,
    player1Score: match.player1Score,
    player2Score: match.player2Score,
    player1PenaltyScore: match.player1PenaltyScore,
    player2PenaltyScore: match.player2PenaltyScore,
    notes: match.notes,
    player1Id: match.player1Id,
    player2Id: match.player2Id,
    participant1EntryId: match.participant1EntryId,
    participant2EntryId: match.participant2EntryId,
    winnerId: match.winnerId,
    winnerEntryId: match.winnerEntryId,
    isPenaltyTiebreak: match.isPenaltyTiebreak,
    seriesWinsRequired: match.seriesWinsRequired,
    participant1Entry: match.participant1Entry ? { clubName: match.participant1Entry.clubName, clubSlug: match.participant1Entry.clubSlug } : null,
    participant2Entry: match.participant2Entry ? { clubName: match.participant2Entry.clubName, clubSlug: match.participant2Entry.clubSlug } : null,
    player1: match.player1 ? { name: match.player1.name } : null,
    player2: match.player2 ? { name: match.player2.name } : null,
    bracketId: match.bracketId,
    stageId: match.stageId,
    stage: match.stage
      ? { id: match.stage.id, name: match.stage.name, type: match.stage.type, orderIndex: match.stage.orderIndex }
      : null,
    group: match.group ? { name: match.group.name } : null,
    configuredReliabilityPenalty: getConfiguredMatchPenalty(match, configuredPenaltyEvents),
  }));

  const participants = tournament.participants.map((participant) => ({
    id: participant.id,
    userId: participant.userId,
    clubName: participant.clubName,
    clubSlug: participant.clubSlug,
    clubBadgePath: participant.clubBadgePath,
    user: {
      name: participant.user.name,
    },
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              Ручной редактор матчей
            </CardTitle>
            <CardDescription>{tournament.title}: live search, фильтры, drag-and-drop и ручная правка матчей.</CardDescription>
          </CardHeader>
        </Card>

        <Button asChild variant="outline" className="w-full lg:w-auto">
          <Link href={`/admin/tournaments/${tournament.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к турниру
          </Link>
        </Button>
      </div>

      <MatchManager
        tournamentId={tournament.id}
        matches={matches}
        participants={participants}
        matchPenaltyReasons={matchPenaltyReasons}
      />
    </div>
  );
}
