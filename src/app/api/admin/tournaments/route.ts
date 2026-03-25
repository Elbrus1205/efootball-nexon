import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { generateTournamentMatches, generateTournamentSchedule, generateTournamentStages } from "@/lib/services/tournaments";
import { tournamentBuilderSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";

function checkboxValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

export async function POST(request: Request) {
  const session = await requireRole([UserRole.ADMIN]);
  const origin = new URL(request.url).origin;

  try {
    const formData = await request.formData();
    const parsed = tournamentBuilderSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      rules: formData.get("rules"),
      startsAt: formData.get("startsAt"),
      registrationEndsAt: formData.get("registrationEndsAt"),
      endsAt: formData.get("endsAt"),
      maxParticipants: formData.get("maxParticipants"),
      prizePool: formData.get("prizePool"),
      format: formData.get("format"),
      status: formData.get("status"),
      coverImage: formData.get("coverImage"),
      playoffType: formData.get("playoffType") || null,
      seedingMethod: formData.get("seedingMethod"),
      roundsInLeague: formData.get("roundsInLeague"),
      groupsCount: formData.get("groupsCount") || null,
      participantsPerGroup: formData.get("participantsPerGroup") || null,
      playoffTeamsPerGroup: formData.get("playoffTeamsPerGroup") || null,
      pointsForWin: formData.get("pointsForWin"),
      pointsForDraw: formData.get("pointsForDraw"),
      pointsForLoss: formData.get("pointsForLoss"),
      autoCreateMatches: checkboxValue(formData.get("autoCreateMatches")),
      autoCreateStages: checkboxValue(formData.get("autoCreateStages")),
      autoCreateSchedule: checkboxValue(formData.get("autoCreateSchedule")),
      autoAdvanceFromGroups: checkboxValue(formData.get("autoAdvanceFromGroups")),
      manualBracketControl: checkboxValue(formData.get("manualBracketControl")),
      manualPlayoffSelection: checkboxValue(formData.get("manualPlayoffSelection")),
      checkInRequired: checkboxValue(formData.get("checkInRequired")),
      clubSelectionMode: formData.get("clubSelectionMode"),
      sortRules: formData.getAll("sortRules"),
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Не удалось проверить форму турнира.";
      return NextResponse.redirect(new URL(`/admin/tournaments/builder?error=${encodeURIComponent(message)}`, origin), 303);
    }

    const body = parsed.data;

    const tournament = await db.tournament.create({
      data: {
        title: body.title,
        slug: `${slugify(body.title)}-${Date.now()}`,
        description: body.description,
        rules: body.rules,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        registrationEndsAt: new Date(body.registrationEndsAt),
        maxParticipants: body.maxParticipants,
        prizePool: body.prizePool || null,
        format: body.format,
        status: body.status,
        coverImage: body.coverImage || null,
        playoffType: body.playoffType ?? null,
        seedingMethod: body.seedingMethod,
        roundsInLeague: body.roundsInLeague,
        groupsCount: body.groupsCount ?? null,
        participantsPerGroup: body.participantsPerGroup ?? null,
        playoffTeamsPerGroup: body.playoffTeamsPerGroup ?? null,
        pointsForWin: body.pointsForWin,
        pointsForDraw: body.pointsForDraw,
        pointsForLoss: body.pointsForLoss,
        autoCreateMatches: body.autoCreateMatches,
        autoCreateStages: body.autoCreateStages,
        autoCreateSchedule: body.autoCreateSchedule,
        autoAdvanceFromGroups: body.autoAdvanceFromGroups,
        manualBracketControl: body.manualBracketControl,
        manualPlayoffSelection: body.manualPlayoffSelection,
        checkInRequired: body.checkInRequired,
        clubSelectionMode: body.clubSelectionMode,
        sortRules: body.sortRules,
        createdById: session.user.id,
      },
    });

    if (body.autoCreateStages) {
      await generateTournamentStages(tournament.id);
    }

    if (body.autoCreateMatches) {
      await generateTournamentMatches(tournament.id);
    }

    if (body.autoCreateSchedule) {
      await generateTournamentSchedule(tournament.id, { overwrite: true });
    }

    return NextResponse.redirect(new URL("/admin/tournaments?created=1", origin), 303);
  } catch (error) {
    console.error("Failed to create tournament", error);
    return NextResponse.redirect(new URL("/admin/tournaments/builder?error=Не удалось создать турнир. Проверьте поля и базу данных.", origin), 303);
  }
}
