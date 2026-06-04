import Link from "next/link";
import { ArrowLeft, Swords } from "lucide-react";
import { notFound } from "next/navigation";
import { MatchManager } from "@/components/admin/match-manager";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminTournamentAccessWhere } from "@/lib/admin-tournament-access";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentMatchesPage({ params }: { params: { id: string } }) {
  const session = await requireAnyPermission(["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);

  const tournament = await db.tournament.findFirst({
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
          player1: { select: { name: true } },
          player2: { select: { name: true } },
          stage: { select: { name: true, type: true } },
          group: { select: { name: true } },
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
    },
  });

  if (!tournament) notFound();

  const matches = tournament.matches.map((match) => ({
    id: match.id,
    round: match.round,
    matchNumber: match.matchNumber,
    status: match.status,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
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
    stage: match.stage ? { name: match.stage.name, type: match.stage.type } : null,
    group: match.group ? { name: match.group.name } : null,
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
      />
    </div>
  );
}
