import { NextResponse } from "next/server";
import { NotificationType, Prisma, TournamentFormat, TournamentStatus, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseFormatBlueprintJson } from "@/lib/format-blueprint";
import { createNotificationForAllUsers } from "@/lib/services/notifications";
import { publishTournamentAnnouncement, syncTournamentBulletin } from "@/lib/services/telegram-publications";
import { getActiveSeason } from "@/lib/services/seasons";
import {
  generateTournamentMatches,
  generateTournamentSchedule,
  generateTournamentStages,
  resolveAutoRegistrationStatus,
} from "@/lib/services/tournaments";
import { tournamentBuilderSchema } from "@/lib/validators";
import { parseMoscowDateTimeLocal, slugify } from "@/lib/utils";
import { ensureManagedClubCatalog } from "@/lib/clubs";
import { validateStageGraph } from "@/lib/tournament-stage-graph";

function checkboxValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

function resolveInitialStatus(status: TournamentStatus, startsAt: Date, autoOpenRegistration: boolean) {
  return resolveAutoRegistrationStatus(status, autoOpenRegistration, startsAt);
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
      requireLineupPhoto: checkboxValue(formData.get("requireLineupPhoto")),
      telegramCommunityId: formData.get("telegramCommunityId"),
      telegramChannelId: formData.get("telegramChannelId"),
      telegramGroupId: formData.get("telegramGroupId"),
      telegramAutoPublish: checkboxValue(formData.get("telegramAutoPublish")),
      clubSelectionMode: formData.get("clubSelectionMode"),
      clubSelectionByLeague: checkboxValue(formData.get("clubSelectionByLeague")),
      clubSelectionInGameOnly: checkboxValue(formData.get("clubSelectionInGameOnly")),
      selectedLeagueSlugs: formData.getAll("selectedLeagueSlugs"),
      sortRules: formData.getAll("sortRules"),
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Не удалось проверить форму турнира.";
      return NextResponse.redirect(new URL(`/admin/tournaments/builder?error=${encodeURIComponent(message)}`, origin), 303);
    }

    const body = parsed.data;
    const formatBlueprint = parseFormatBlueprintJson(typeof body.formatBlueprintJson === "string" ? body.formatBlueprintJson : "");
    if (formatBlueprint?.stageGraph) {
      const issue = validateStageGraph(formatBlueprint.stageGraph)[0];
      if (issue) {
        return NextResponse.redirect(new URL(`/admin/tournaments/builder?error=${encodeURIComponent(issue.message)}`, origin), 303);
      }
    }
    const startsAt = parseMoscowDateTimeLocal(body.startsAt);
    const activeSeason = await getActiveSeason();
    const status = resolveInitialStatus(body.status, startsAt, body.autoOpenRegistration);
    const isTest = body.isTest || session.user.role === UserRole.TRAINEE;
    const notificationsEnabled = session.user.role !== UserRole.TRAINEE && !isTest;

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
        formatBlueprintJson: formatBlueprint ?? Prisma.DbNull,
        status,
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
        notificationsEnabled,
        telegramCommunityId: body.telegramCommunityId || null,
        telegramChannelId: body.telegramChannelId || null,
        telegramGroupId: body.telegramGroupId || null,
        telegramAutoPublish: body.telegramAutoPublish,
        clubSelectionMode: body.clubSelectionMode,
        clubSelectionByLeague: body.clubSelectionByLeague,
        clubSelectionInGameOnly: body.clubSelectionInGameOnly,
        sortRules: body.sortRules,
        createdById: session.user.id,
      },
    });

    if (body.clubSelectionByLeague && body.selectedLeagueSlugs.length) {
      await ensureManagedClubCatalog();
      const leagues = await db.league.findMany({ where: { slug: { in: body.selectedLeagueSlugs }, isEnabled: true }, select: { id: true } });
      if (leagues.length) {
        await db.tournamentLeague.createMany({ data: leagues.map((league) => ({ tournamentId: tournament.id, leagueId: league.id })), skipDuplicates: true });
      }
    }

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

    if (notificationsEnabled && status === TournamentStatus.REGISTRATION_OPEN) {
      await createNotificationForAllUsers({
        title: "Открыта регистрация на турнир",
        body: `${tournament.title}: новый турнир уже доступен для регистрации.`,
        type: NotificationType.TOURNAMENT,
        link: `/tournaments/${tournament.id}`,
        dedupeWithinHours: 24,
      });
    }

    if (body.telegramAutoPublish) {
      const publication = status === TournamentStatus.REGISTRATION_OPEN
        ? publishTournamentAnnouncement(tournament.id)
        : syncTournamentBulletin(tournament.id);
      await publication.catch((error) => console.error("Failed to publish Telegram tournament message", error));
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
