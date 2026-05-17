import { NextResponse } from "next/server";
import { NotificationType, Prisma, TournamentFormat, TournamentStatus } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseFormatBlueprintJson } from "@/lib/format-blueprint";
import { createNotificationForAllUsers } from "@/lib/services/notifications";
import { tournamentBuilderSchema } from "@/lib/validators";

function checkboxValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

function resolveUpdatedStatus(status: TournamentStatus, startsAt: Date, autoOpenRegistration: boolean) {
  if (!autoOpenRegistration) return status;
  return startsAt <= new Date() ? TournamentStatus.REGISTRATION_OPEN : TournamentStatus.DRAFT;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requirePermission("tournaments.createEdit");

  const formData = await request.formData();
  const body = tournamentBuilderSchema.parse({
    title: formData.get("title"),
    rules: formData.get("rules"),
    startsAt: formData.get("startsAt"),
    registrationEndsAt: formData.get("startsAt"),
    endsAt: "",
    maxParticipants: formData.get("maxParticipants"),
    prizePool: formData.get("prizePool"),
    format: TournamentFormat.CUSTOM,
    status: formData.get("status"),
    coverImage: formData.get("coverImage"),
    formatBlueprintJson: formData.get("formatBlueprintJson"),
    playoffType: formData.get("playoffType") || null,
    playoffLegs: formData.get("playoffLegs") || 1,
    playoffThirdPlace: checkboxValue(formData.get("playoffThirdPlace")),
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
    autoOpenRegistration: checkboxValue(formData.get("autoOpenRegistration")),
    autoAdvanceFromGroups: checkboxValue(formData.get("autoAdvanceFromGroups")),
    manualBracketControl: checkboxValue(formData.get("manualBracketControl")),
    manualPlayoffSelection: checkboxValue(formData.get("manualPlayoffSelection")),
    checkInRequired: checkboxValue(formData.get("checkInRequired")),
    requireTelegramForRegistration: checkboxValue(formData.get("requireTelegramForRegistration")),
    clubSelectionMode: formData.get("clubSelectionMode"),
    sortRules: formData.getAll("sortRules"),
  });

  const formatBlueprint = parseFormatBlueprintJson(typeof body.formatBlueprintJson === "string" ? body.formatBlueprintJson : "");
  const startsAt = new Date(body.startsAt);
  const status = resolveUpdatedStatus(body.status, startsAt, body.autoOpenRegistration);

  const before = await db.tournament.findUnique({
    where: { id: params.id },
    select: { status: true, title: true },
  });

  const updated = await db.tournament.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: "",
      rules: body.rules,
      startsAt,
      endsAt: null,
      registrationEndsAt: startsAt,
      registrationStartsAt: body.autoOpenRegistration ? startsAt : null,
      maxParticipants: body.maxParticipants,
      prizePool: body.prizePool || null,
      format: TournamentFormat.CUSTOM,
      formatBlueprintJson: formatBlueprint ?? Prisma.DbNull,
      status,
      coverImage: body.coverImage || null,
      playoffType: null,
      playoffLegs: 1,
      playoffThirdPlace: false,
      seedingMethod: body.seedingMethod,
      roundsInLeague: 1,
      groupsCount: null,
      participantsPerGroup: null,
      playoffTeamsPerGroup: null,
      pointsForWin: body.pointsForWin,
      pointsForDraw: body.pointsForDraw,
      pointsForLoss: body.pointsForLoss,
      autoCreateMatches: body.autoCreateMatches,
      autoCreateStages: true,
      autoCreateSchedule: body.autoCreateSchedule,
      autoOpenRegistration: body.autoOpenRegistration,
      autoAdvanceFromGroups: body.autoAdvanceFromGroups,
      manualBracketControl: body.manualBracketControl,
      manualPlayoffSelection: body.manualPlayoffSelection,
      checkInRequired: body.checkInRequired,
      requireTelegramForRegistration: body.requireTelegramForRegistration,
      clubSelectionMode: body.clubSelectionMode,
      sortRules: body.sortRules,
    },
  });

  if (before?.status !== TournamentStatus.REGISTRATION_OPEN && updated.status === TournamentStatus.REGISTRATION_OPEN) {
    await createNotificationForAllUsers({
      title: "Регистрация на турнир началась",
      body: `${updated.title}: регистрация открыта. Можно занимать место в турнире.`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${updated.id}`,
      dedupeWithinHours: 24,
    });
  }

  const origin = getRequestBaseUrl(request);
  return NextResponse.redirect(new URL("/admin/tournaments?updated=1", origin), 303);
}
