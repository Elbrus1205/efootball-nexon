import { NextResponse } from "next/server";
import { NotificationType, Prisma, TournamentFormat, TournamentStatus, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { normalizeFormatBlueprint, parseFormatBlueprintJson } from "@/lib/format-blueprint";
import { createNotificationForAllUsers } from "@/lib/services/notifications";
import { publishTournamentAnnouncement, syncTournamentBulletin } from "@/lib/services/telegram-publications";
import {
  assertTournamentEditAllowed,
  notifyTournamentChanges,
  resolveAutoRegistrationStatus,
  synchronizeTournamentAfterEdit,
  TournamentEditConflictError,
} from "@/lib/services/tournaments";
import { invalidateTournamentAll } from "@/lib/tournament-cache";
import { tournamentBuilderSchema } from "@/lib/validators";
import { parseMoscowDateTimeLocal } from "@/lib/utils";
import { ensureManagedClubCatalog } from "@/lib/clubs";
import { validateStageGraph } from "@/lib/tournament-stage-graph";

function checkboxValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

function resolveUpdatedStatus(status: TournamentStatus, startsAt: Date, autoOpenRegistration: boolean) {
  return resolveAutoRegistrationStatus(status, autoOpenRegistration, startsAt);
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.createEdit");
  await assertCanManageTournament(session, params.id);

  const formData = await request.formData();
  const body = tournamentBuilderSchema.parse({
    title: formData.get("title"),
    rules: formData.get("rules"),
    startsAt: formData.get("startsAt"),
    registrationEndsAt: formData.get("startsAt"),
    endsAt: "",
    maxParticipants: formData.get("maxParticipants"),
    participantMode: formData.get("participantMode"),
    rosterSize: formData.get("rosterSize"),
    topRankingRestrictionEnabled: checkboxValue(formData.get("topRankingRestrictionEnabled")),
    topRankingLimit: formData.get("topRankingLimit"),
    topRankingPlayerLimit: formData.get("topRankingPlayerLimit"),
    captainsCreateTeamMatches: checkboxValue(formData.get("captainsCreateTeamMatches")),
    matchupFormat: formData.get("matchupFormat"),
    bestOfWins: formData.get("bestOfWins"),
    isTest: checkboxValue(formData.get("isTest")),
    prizePool: formData.get("prizePool"),
    format: TournamentFormat.CUSTOM,
    status: formData.get("status"),
    coverImage: formData.get("coverImage"),
    lineupPhotoExampleUrl: formData.get("lineupPhotoExampleUrl"),
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
    requireLineupPhoto: checkboxValue(formData.get("requireLineupPhoto")),
    telegramCommunityId: formData.get("telegramCommunityId"),
    telegramChannelId: formData.get("telegramChannelId"),
    telegramGroupId: formData.get("telegramGroupId"),
    telegramAutoPublish: checkboxValue(formData.get("telegramAutoPublish")),
    clubSelectionMode: formData.get("clubSelectionMode"),
    clubSelectionByLeague: checkboxValue(formData.get("clubSelectionByLeague")),
    participantDistributionByLeague: checkboxValue(formData.get("participantDistributionByLeague")),
    clubSelectionInGameOnly: checkboxValue(formData.get("clubSelectionInGameOnly")),
    selectedLeagueSlugs: formData.getAll("selectedLeagueSlugs"),
    sortRules: formData.getAll("sortRules"),
  });

  const submittedBlueprintJson = typeof body.formatBlueprintJson === "string" ? body.formatBlueprintJson : "";
  const formatBlueprint = parseFormatBlueprintJson(submittedBlueprintJson);
  if (formatBlueprint?.stageGraph) {
    const issues = validateStageGraph(formatBlueprint.stageGraph);
    if (issues.length) {
      const redirectUrl = new URL(`/admin/tournaments/${params.id}/edit`, getRequestBaseUrl(request));
      redirectUrl.searchParams.set("error", issues.map((issue) => issue.message).join(" "));
      return NextResponse.redirect(redirectUrl, 303);
    }
  }
  const startsAt = parseMoscowDateTimeLocal(body.startsAt);
  const status = resolveUpdatedStatus(body.status, startsAt, body.autoOpenRegistration);
  const isTest = body.isTest || session.user.role === UserRole.TRAINEE;

  const before = await db.tournament.findUnique({
    where: { id: params.id },
    select: {
      status: true,
      title: true,
      rules: true,
      notificationsEnabled: true,
      startsAt: true,
      prizePool: true,
      format: true,
      formatBlueprintJson: true,
      maxParticipants: true,
      participantMode: true,
      rosterSize: true,
      captainsCreateTeamMatches: true,
      matchupFormat: true,
      bestOfWins: true,
      pointsForWin: true,
      pointsForDraw: true,
      pointsForLoss: true,
      sortRules: true,
    },
  });

  if (!before) {
    return NextResponse.redirect(new URL("/admin/tournaments?warning=Турнир не найден.", getRequestBaseUrl(request)), 303);
  }

  if (submittedBlueprintJson.trim() && !formatBlueprint) {
    const redirectUrl = new URL(`/admin/tournaments/${params.id}/edit`, getRequestBaseUrl(request));
    redirectUrl.searchParams.set("error", "Конфигурация этапов повреждена. Обновите страницу и повторите изменение.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const nextBlueprint = formatBlueprint ?? normalizeFormatBlueprint(before.formatBlueprintJson);

  try {
    await assertTournamentEditAllowed({
      tournamentId: params.id,
      previousBlueprintJson: before.formatBlueprintJson,
      nextBlueprint,
      previousMaxParticipants: before.maxParticipants,
      nextMaxParticipants: body.maxParticipants,
      previousMatchShape: {
        participantMode: before.participantMode,
        rosterSize: before.rosterSize,
        captainsCreateTeamMatches: before.captainsCreateTeamMatches,
        matchupFormat: before.matchupFormat,
        bestOfWins: before.bestOfWins,
      },
      nextMatchShape: {
        participantMode: body.participantMode,
        rosterSize: body.participantMode === "SINGLE" ? 1 : body.rosterSize,
        captainsCreateTeamMatches: body.participantMode === "TEAM" && body.captainsCreateTeamMatches,
        matchupFormat: body.matchupFormat,
        bestOfWins: body.matchupFormat === "BEST_OF" ? body.bestOfWins : 1,
      },
      previousScoringShape: {
        pointsForWin: before.pointsForWin,
        pointsForDraw: before.pointsForDraw,
        pointsForLoss: before.pointsForLoss,
        sortRules: before.sortRules,
      },
      nextScoringShape: {
        pointsForWin: body.pointsForWin,
        pointsForDraw: body.pointsForDraw,
        pointsForLoss: body.pointsForLoss,
        sortRules: body.sortRules,
      },
      previousStartsAt: before.startsAt,
      nextStartsAt: startsAt,
    });
  } catch (error) {
    if (!(error instanceof TournamentEditConflictError)) {
      console.error("Failed to validate tournament edit", error);
    }
    const message = error instanceof TournamentEditConflictError
      ? error.message
      : "Не удалось проверить изменения турнира. Повторите попытку.";
    const redirectUrl = new URL(`/admin/tournaments/${params.id}/edit`, getRequestBaseUrl(request));
    redirectUrl.searchParams.set("error", message);
    return NextResponse.redirect(redirectUrl, 303);
  }

  const updated = await db.tournament.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: "",
      rules: session.user.role === UserRole.TRAINEE ? before?.rules : body.rules,
      startsAt,
      endsAt: null,
      registrationEndsAt: startsAt,
      registrationStartsAt: body.autoOpenRegistration ? startsAt : null,
      maxParticipants: body.maxParticipants,
      participantMode: body.participantMode,
      rosterSize: body.participantMode === "SINGLE" ? 1 : body.rosterSize,
      topRankingRestrictionEnabled: body.participantMode === "TEAM" && body.topRankingRestrictionEnabled,
      topRankingLimit: body.topRankingLimit,
      topRankingPlayerLimit: body.topRankingPlayerLimit,
      captainsCreateTeamMatches: body.participantMode === "TEAM" && body.captainsCreateTeamMatches,
      matchupFormat: body.matchupFormat,
      bestOfWins: body.matchupFormat === "BEST_OF" ? body.bestOfWins : 1,
      isTest,
      prizePool: body.prizePool || null,
      format: TournamentFormat.CUSTOM,
      formatBlueprintJson: nextBlueprint as Prisma.InputJsonValue,
      status,
      registrationClosedAt:
        status === TournamentStatus.DRAFT || status === TournamentStatus.REGISTRATION_OPEN ? null : undefined,
      coverImage: body.coverImage || null,
      lineupPhotoExampleUrl: body.lineupPhotoExampleUrl || null,
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
      requireTelegramForRegistration: true,
      requireLineupPhoto: body.requireLineupPhoto,
      notificationsEnabled: session.user.role !== UserRole.TRAINEE && !isTest,
      telegramCommunityId: body.telegramCommunityId || null,
      telegramChannelId: body.telegramChannelId || null,
      telegramGroupId: body.telegramGroupId || null,
      telegramAutoPublish: body.telegramAutoPublish,
      clubSelectionMode: body.clubSelectionMode,
      clubSelectionByLeague: body.clubSelectionByLeague,
      participantDistributionByLeague: body.participantDistributionByLeague,
      clubSelectionInGameOnly: body.clubSelectionInGameOnly,
      sortRules: body.sortRules,
    },
  });

  await db.tournamentLeague.deleteMany({ where: { tournamentId: updated.id } });
  if (body.clubSelectionByLeague && body.selectedLeagueSlugs.length) {
    await ensureManagedClubCatalog();
    const leagues = await db.league.findMany({ where: { slug: { in: body.selectedLeagueSlugs }, isEnabled: true }, select: { id: true } });
    if (leagues.length) {
      await db.tournamentLeague.createMany({ data: leagues.map((league) => ({ tournamentId: updated.id, leagueId: league.id })), skipDuplicates: true });
    }
  }

  try {
    await synchronizeTournamentAfterEdit({
      tournamentId: updated.id,
      previousBlueprintJson: before.formatBlueprintJson,
      previousMaxParticipants: before.maxParticipants,
      previousMatchShape: {
        participantMode: before.participantMode,
        rosterSize: before.rosterSize,
        captainsCreateTeamMatches: before.captainsCreateTeamMatches,
        matchupFormat: before.matchupFormat,
        bestOfWins: before.bestOfWins,
      },
      previousScoringShape: {
        pointsForWin: before.pointsForWin,
        pointsForDraw: before.pointsForDraw,
        pointsForLoss: before.pointsForLoss,
        sortRules: before.sortRules,
      },
      previousStartsAt: before.startsAt,
    });
  } catch (error) {
    console.error("Failed to synchronize tournament edit", error);
    await db.tournament.update({
      where: { id: updated.id },
      data: {
        formatBlueprintJson: before.formatBlueprintJson ?? Prisma.DbNull,
        maxParticipants: before.maxParticipants,
        participantMode: before.participantMode,
        rosterSize: before.rosterSize,
        captainsCreateTeamMatches: before.captainsCreateTeamMatches,
        matchupFormat: before.matchupFormat,
        bestOfWins: before.bestOfWins,
        pointsForWin: before.pointsForWin,
        pointsForDraw: before.pointsForDraw,
        pointsForLoss: before.pointsForLoss,
        sortRules: before.sortRules,
      },
    });
    let derivedRollbackFailed = false;
    try {
      await synchronizeTournamentAfterEdit({
        tournamentId: updated.id,
        previousBlueprintJson: updated.formatBlueprintJson,
        previousMaxParticipants: updated.maxParticipants,
        previousMatchShape: {
          participantMode: updated.participantMode,
          rosterSize: updated.rosterSize,
          captainsCreateTeamMatches: updated.captainsCreateTeamMatches,
          matchupFormat: updated.matchupFormat,
          bestOfWins: updated.bestOfWins,
        },
        previousScoringShape: {
          pointsForWin: updated.pointsForWin,
          pointsForDraw: updated.pointsForDraw,
          pointsForLoss: updated.pointsForLoss,
          sortRules: updated.sortRules,
        },
        previousStartsAt: updated.startsAt,
      });
    } catch (rollbackError) {
      derivedRollbackFailed = true;
      console.error("Failed to roll back derived tournament structure", rollbackError);
    }
    invalidateTournamentAll(updated.id);
    const redirectUrl = new URL(`/admin/tournaments/${params.id}/edit`, getRequestBaseUrl(request));
    redirectUrl.searchParams.set(
      "error",
      derivedRollbackFailed
        ? "Не удалось синхронизировать этапы турнира и полностью восстановить их автоматически. Не запускайте матчи и обратитесь к администратору системы."
        : "Не удалось синхронизировать этапы турнира. Настройки структуры возвращены к предыдущим значениям; остальные поля сохранены.",
    );
    return NextResponse.redirect(redirectUrl, 303);
  }

  const isRegistrationOpenAnnouncement =
    before?.status !== TournamentStatus.REGISTRATION_OPEN && updated.status === TournamentStatus.REGISTRATION_OPEN;

  if (updated.notificationsEnabled && isRegistrationOpenAnnouncement) {
    await createNotificationForAllUsers({
      title: "Регистрация на турнир началась",
      body: `${updated.title}: регистрация открыта. Можно занимать место в турнире.`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${updated.id}`,
      dedupeWithinHours: 24,
    });
  }

  // Notify confirmed participants about meaningful edits (start moved, rules, prize pool, status).
  // Skipped on the registration-open announcement above, which already reaches everyone.
  if (before && !isRegistrationOpenAnnouncement) {
    await notifyTournamentChanges({
      tournamentId: updated.id,
      title: updated.title,
      notificationsEnabled: updated.notificationsEnabled,
      before: {
        startsAt: before.startsAt,
        rules: before.rules,
        prizePool: before.prizePool,
        format: before.format,
        status: before.status,
      },
      after: {
        startsAt: updated.startsAt,
        rules: updated.rules,
        prizePool: updated.prizePool,
        format: updated.format,
        status: updated.status,
      },
    }).catch((error) => console.error("Failed to notify tournament changes", error));
  }

  if (updated.telegramAutoPublish) {
    const publication = updated.status === TournamentStatus.REGISTRATION_OPEN
      ? publishTournamentAnnouncement(updated.id)
      : syncTournamentBulletin(updated.id);
    await publication.catch((error) => console.error("Failed to update Telegram tournament publication", error));
  }

  invalidateTournamentAll(updated.id);

  const origin = getRequestBaseUrl(request);
  return NextResponse.redirect(new URL("/admin/tournaments?updated=1", origin), 303);
}
