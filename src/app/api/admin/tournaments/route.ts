import { NextResponse } from "next/server";
import { NotificationType, Prisma, TournamentFormat, TournamentStatus } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseFormatBlueprintJson } from "@/lib/format-blueprint";
import { createNotificationForAllUsers } from "@/lib/services/notifications";
import { getActiveSeason } from "@/lib/services/seasons";
import { generateTournamentMatches, generateTournamentSchedule, generateTournamentStages } from "@/lib/services/tournaments";
import { tournamentBuilderSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";

function checkboxValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

function resolveInitialStatus(status: TournamentStatus, startsAt: Date, autoOpenRegistration: boolean) {
  if (!autoOpenRegistration) return status;
  return startsAt <= new Date() ? TournamentStatus.REGISTRATION_OPEN : TournamentStatus.DRAFT;
}

export async function POST(request: Request) {
  const session = await requirePermission("tournaments.createEdit");
  const origin = getRequestBaseUrl(request);
  let tournamentCreated = false;

  try {
    const formData = await request.formData();
    const parsed = tournamentBuilderSchema.safeParse({
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
      roundsInLeague: formData.get("roundsInLeague") || null,
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

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Не удалось проверить форму турнира.";
      return NextResponse.redirect(new URL(`/admin/tournaments/builder?error=${encodeURIComponent(message)}`, origin), 303);
    }

    const body = parsed.data;
    const formatBlueprint = parseFormatBlueprintJson(typeof body.formatBlueprintJson === "string" ? body.formatBlueprintJson : "");
    const startsAt = new Date(body.startsAt);
    const activeSeason = await getActiveSeason();
    const status = resolveInitialStatus(body.status, startsAt, body.autoOpenRegistration);

    const tournament = await db.tournament.create({
      data: {
        seasonId: activeSeason?.id ?? null,
        title: body.title,
        slug: `${slugify(body.title)}-${Date.now()}`,
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
        createdById: session.user.id,
      },
    });

    tournamentCreated = true;

    try {
      await generateTournamentStages(tournament.id);

      if (body.autoCreateMatches) {
        await generateTournamentMatches(tournament.id);
      }

      if (body.autoCreateSchedule) {
        await generateTournamentSchedule(tournament.id, { overwrite: true });
      }
    } catch (automationError) {
      console.error("Tournament was created, but automation failed", automationError);
      const warning = encodeURIComponent("Турнир создан, но автоматическая генерация стадий, матчей или расписания выполнилась не полностью.");
      return NextResponse.redirect(new URL(`/admin/tournaments?created=1&warning=${warning}`, origin), 303);
    }

    if (status === TournamentStatus.REGISTRATION_OPEN) {
      await createNotificationForAllUsers({
        title: "Открыта регистрация на турнир",
        body: `${tournament.title}: новый турнир уже доступен для регистрации.`,
        type: NotificationType.TOURNAMENT,
        link: `/tournaments/${tournament.id}`,
        dedupeWithinHours: 24,
      });
    }

    return NextResponse.redirect(new URL("/admin/tournaments?created=1", origin), 303);
  } catch (error) {
    console.error("Failed to create tournament", error);

    if (tournamentCreated) {
      const warning = encodeURIComponent("Турнир создан, но после создания произошла ошибка. Проверьте стадии, матчи и расписание вручную.");
      return NextResponse.redirect(new URL(`/admin/tournaments?created=1&warning=${warning}`, origin), 303);
    }

    return NextResponse.redirect(
      new URL(`/admin/tournaments/builder?error=${encodeURIComponent("Не удалось создать турнир. Проверьте поля и базу данных.")}`, origin),
      303,
    );
  }
}
