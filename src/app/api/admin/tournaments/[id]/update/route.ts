import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tournamentBuilderSchema } from "@/lib/validators";

function checkboxValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);

  const formData = await request.formData();
  const body = tournamentBuilderSchema.parse({
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
    autoCreateStages: true,
    autoCreateSchedule: checkboxValue(formData.get("autoCreateSchedule")),
    autoAdvanceFromGroups: checkboxValue(formData.get("autoAdvanceFromGroups")),
    manualBracketControl: checkboxValue(formData.get("manualBracketControl")),
    manualPlayoffSelection: checkboxValue(formData.get("manualPlayoffSelection")),
    checkInRequired: checkboxValue(formData.get("checkInRequired")),
    clubSelectionMode: formData.get("clubSelectionMode"),
    sortRules: formData.getAll("sortRules"),
  });

  await db.tournament.update({
    where: { id: params.id },
    data: {
      title: body.title,
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
      autoCreateStages: true,
      autoCreateSchedule: body.autoCreateSchedule,
      autoAdvanceFromGroups: body.autoAdvanceFromGroups,
      manualBracketControl: body.manualBracketControl,
      manualPlayoffSelection: body.manualPlayoffSelection,
      checkInRequired: body.checkInRequired,
      clubSelectionMode: body.clubSelectionMode,
      sortRules: body.sortRules,
    },
  });

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL("/admin/tournaments?updated=1", origin), 303);
}
