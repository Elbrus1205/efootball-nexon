import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { TournamentBuilderForm } from "@/components/admin/tournament-builder-form";

function toInputDate(value?: Date | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function AdminTournamentEditPage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
  });

  if (!tournament) notFound();

  return (
    <div className="space-y-6">
      <TournamentBuilderForm
        action={`/api/admin/tournaments/${tournament.id}/update`}
        submitLabel="Сохранить изменения"
        initialValues={{
          title: tournament.title,
          description: tournament.description,
          rules: tournament.rules,
          startsAt: toInputDate(tournament.startsAt),
          endsAt: toInputDate(tournament.endsAt),
          registrationEndsAt: toInputDate(tournament.registrationEndsAt),
          maxParticipants: tournament.maxParticipants,
          prizePool: tournament.prizePool ?? "",
          format: tournament.format,
          status: tournament.status,
          coverImage: tournament.coverImage ?? "",
          playoffType: tournament.playoffType ?? "",
          playoffLegs: tournament.playoffLegs,
          playoffThirdPlace: tournament.playoffThirdPlace,
          seedingMethod: tournament.seedingMethod,
          roundsInLeague: tournament.roundsInLeague,
          groupsCount: tournament.groupsCount,
          participantsPerGroup: tournament.participantsPerGroup,
          playoffTeamsPerGroup: tournament.playoffTeamsPerGroup,
          pointsForWin: tournament.pointsForWin,
          pointsForDraw: tournament.pointsForDraw,
          pointsForLoss: tournament.pointsForLoss,
          autoCreateMatches: tournament.autoCreateMatches,
          autoCreateSchedule: tournament.autoCreateSchedule,
          autoAdvanceFromGroups: tournament.autoAdvanceFromGroups,
          manualBracketControl: tournament.manualBracketControl,
          manualPlayoffSelection: tournament.manualPlayoffSelection,
          checkInRequired: tournament.checkInRequired,
          clubSelectionMode: tournament.clubSelectionMode,
          sortRules: tournament.sortRules,
        }}
      />
    </div>
  );
}
