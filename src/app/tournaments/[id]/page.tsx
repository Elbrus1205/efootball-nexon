import { ClubSelectionMode, MatchStatus, ParticipantStatus, StageType, TournamentApplicationStatus, TournamentFormat, TournamentStatus } from "@prisma/client";
import { Clock3, Search, Send } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getCachedTournamentParticipants,
  getCachedTournamentRules,
  getCachedTournamentSchedule,
  getCachedTournamentStructure,
} from "@/lib/tournament-cache";
import { CancelTournamentRegistrationButton } from "@/components/tournaments/cancel-tournament-registration-button";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import {
  LazyBracketView as BracketView,
  LazyMyMatchCard as MyMatchCard,
  LazyRosterManager as RosterManager,
  LazyTournamentScheduleView as TournamentScheduleView,
  LazyTournamentStageSwitcher as TournamentStageSwitcher,
} from "@/components/tournaments/lazy-tournament-widgets";
import { RegisterTournamentButton } from "@/components/tournaments/register-tournament-button";
import { TeamMatchAssignment } from "@/components/tournaments/team-match-assignment";
import { TournamentEmptyState } from "@/components/tournaments/tournament-empty-state";
import { TournamentHero } from "@/components/tournaments/tournament-hero";
import { TournamentNavigation } from "@/components/tournaments/tournament-navigation";
import type { TournamentStageOption } from "@/components/tournaments/tournament-stage-switcher";
import { TelegramProfileLink } from "@/components/telegram-profile-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { getAvailableClubs } from "@/lib/clubs";
import {
  playoffTypeLabel,
  tournamentStatusLabel,
  tournamentStatusVariant,
} from "@/lib/admin-display";
import { db } from "@/lib/db";
import { normalizeFormatBlueprint } from "@/lib/format-blueprint";
import { getPlayerDisplayName } from "@/lib/player-name";
import { RELIABILITY_REGISTRATION_THRESHOLD } from "@/lib/services/reliability";
import { getTelegramProfileLinks, hasPublicTelegramUsername, hasTelegramRegistrationContact } from "@/lib/social-links";
import {
  buildCaptainTeamMatchSlotLabels,
  compareCaptainAssignedTeamMatches,
} from "@/lib/tournaments/captain-team-match-presentation";
import { cn, formatDate } from "@/lib/utils";
import {
  buildLeagueTable as buildPublicLeagueTable,
  getTournamentTabs,
  isTournamentTabValue as isPublicTournamentTabValue,
  participantModeLabel as publicParticipantModeLabel,
  prioritizeCurrentGroup,
  stagePresentationState,
} from "@/lib/tournament-public-view";

type LeagueRow = {
  id: string;
  isCurrentTeam?: boolean;
  rank?: number | null;
  clubName: string;
  clubBadgePath?: string | null;
  playerId?: string | null;
  playerName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDifference: number;
  points: number;
};

type StandingHighlight = {
  fromRank: number;
  toRank: number;
  label: string;
  rowClass: string;
  badgeClass: string;
};

type EmptyGroupSlot = {
  id: string;
  position: number;
};

function TournamentTabContent({ children }: { children: React.ReactNode }) {
  return <div className="mt-6">{children}</div>;
}

const CUSTOM_STANDING_HIGHLIGHT_STYLES = [
  {
    rowClass: "border-t border-sky-400/20 bg-sky-400/8",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-400/15 px-1 text-[10px] font-semibold text-sky-300",
  },
  {
    rowClass: "border-t border-emerald-400/20 bg-emerald-400/8",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400/15 px-1 text-[10px] font-semibold text-emerald-300",
  },
  {
    rowClass: "border-t border-amber-400/20 bg-amber-400/8",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400/15 px-1 text-[10px] font-semibold text-amber-300",
  },
  {
    rowClass: "border-t border-violet-400/20 bg-violet-400/8",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-400/15 px-1 text-[10px] font-semibold text-violet-300",
  },
  {
    rowClass: "border-t border-rose-400/20 bg-rose-400/8",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-400/15 px-1 text-[10px] font-semibold text-rose-300",
  },
  {
    rowClass: "border-t border-cyan-400/20 bg-cyan-400/8",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400/15 px-1 text-[10px] font-semibold text-cyan-300",
  },
] as const;

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function scheduleMatchTime(match: { scheduledAt?: Date | string | null; createdAt: Date | string; schedules: Array<{ startsAt: Date | string }> }) {
  return new Date(match.scheduledAt ?? match.schedules[0]?.startsAt ?? match.createdAt).getTime();
}

function playoffRoundLabel(round: number, totalRounds: number) {
  const roundsRemaining = totalRounds - round;

  if (roundsRemaining <= 0) return "Финал";
  if (roundsRemaining === 1) return "1/2 финала";
  if (roundsRemaining === 2) return "1/4 финала";
  if (roundsRemaining === 3) return "1/8 финала";

  return `1/${2 ** roundsRemaining} финала`;
}

function scheduleSectionTitle(match: {
  round: number;
  bracket?: string | null;
  isThirdPlaceMatch?: boolean;
  group?: { name: string; orderIndex?: number | null } | null;
  stage?: { name: string | null; type?: StageType | null; roundsCount?: number | null } | null;
}) {
  if (match.stage?.type === StageType.PLAYOFF) {
    if (match.isThirdPlaceMatch) return "Матч за 3-е место";
    if (match.bracket === "lower") return `Нижняя сетка • Раунд ${match.round}`;

    return playoffRoundLabel(match.round, Math.max(match.stage.roundsCount ?? match.round, match.round));
  }

  return `${match.round} тур`;
}

function buildScheduleSections<
  T extends {
    id: string;
    round: number;
    matchNumber: number;
    player1Id?: string | null;
    player2Id?: string | null;
    stage?: {
      id: string;
      orderIndex: number;
      type?: StageType | null;
      roundsCount?: number | null;
      name: string | null;
      deadlines?: Array<{ round: number; deadlineAt: Date | string | null }>;
    } | null;
    group?: { id: string; orderIndex: number; name: string } | null;
    bracket?: string | null;
    isThirdPlaceMatch?: boolean;
    scheduledAt?: Date | string | null;
    createdAt: Date | string;
    schedules: Array<{ startsAt: Date | string }>;
  },
>(matches: T[]) {
  const sections = new Map<string, { key: string; title: string; sort: number[]; deadlineAt: Date | string | null; matches: T[] }>();

  for (const match of matches) {
    const stageSort = match.stage?.orderIndex ?? 999;
    const groupSort = match.group?.orderIndex ?? 0;
    const deadlineAt = match.stage?.deadlines?.find((item) => item.round === match.round)?.deadlineAt ?? null;

    if (match.stage?.type !== StageType.PLAYOFF) {
      const key = [match.stage?.id ?? "stage", "tour", match.round].join(":");
      const section = sections.get(key);

      if (section) {
        section.matches.push(match);
        section.deadlineAt ??= deadlineAt;
      } else {
        sections.set(key, {
          key,
          title: scheduleSectionTitle(match),
          sort: [stageSort, 0, 0, match.round, 0],
          deadlineAt,
          matches: [match],
        });
      }

      continue;
    }

    const bracketSort = match.stage?.type === StageType.PLAYOFF && match.bracket === "lower" ? 1 : 0;
    const thirdPlaceSort = match.isThirdPlaceMatch ? 1 : 0;
    const key = [match.stage?.id ?? "stage", match.group?.id ?? "all", match.bracket ?? "none", match.round, thirdPlaceSort].join(":");
    const section = sections.get(key);

    if (section) {
      section.matches.push(match);
      section.deadlineAt ??= deadlineAt;
    } else {
      sections.set(key, {
        key,
        title: scheduleSectionTitle(match),
        sort: [stageSort, groupSort, bracketSort, match.round, thirdPlaceSort],
        deadlineAt,
        matches: [match],
      });
    }
  }

  return Array.from(sections.values())
    .sort((a, b) => {
      for (let index = 0; index < a.sort.length; index += 1) {
        const diff = a.sort[index] - b.sort[index];
        if (diff !== 0) return diff;
      }

      return 0;
    })
    .map((section) => ({
      ...section,
      matches: section.matches.sort(
        (a, b) =>
          (a.group?.orderIndex ?? 0) - (b.group?.orderIndex ?? 0) ||
          a.matchNumber - b.matchNumber ||
          scheduleMatchTime(a) - scheduleMatchTime(b),
      ),
    }));
}

function isBrokenClubName(value: string | null | undefined) {
  const name = value?.trim();
  if (!name) return true;

  const questionMarks = name.match(/\?/g)?.length ?? 0;
  return questionMarks >= 3 || questionMarks / name.length > 0.4;
}

function pluralRu(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

function resolveClubName(
  entry: {
    clubSlug?: string | null;
    clubName?: string | null;
    teamName?: string | null;
  },
  clubsBySlug: Map<string, { name: string }>,
  fallback: string,
) {
  if (entry.teamName?.trim()) {
    return entry.teamName.trim();
  }

  if (entry.clubSlug) {
    const club = clubsBySlug.get(entry.clubSlug);
    if (club && isBrokenClubName(entry.clubName)) {
      return club.name;
    }
  }

  return entry.clubName?.trim() && !isBrokenClubName(entry.clubName) ? entry.clubName.trim() : fallback;
}

function resolveClubBadgePath(
  entry: {
    clubSlug?: string | null;
    clubBadgePath?: string | null;
  },
  clubsBySlug: Map<string, { imagePath: string }>,
) {
  if (entry.clubBadgePath?.trim()) return entry.clubBadgePath;
  return entry.clubSlug ? clubsBySlug.get(entry.clubSlug)?.imagePath ?? null : null;
}

function getReplacementRegistrationId(notes?: string | null) {
  return notes?.match(/replacementRegistrationId:([A-Za-z0-9]+)/)?.[1] ?? null;
}

function resolveReplacementRegistrationId(entryId: string, replacements: Map<string, string>) {
  let current = entryId;
  const seen = new Set<string>();

  while (replacements.has(current) && !seen.has(current)) {
    seen.add(current);
    current = replacements.get(current)!;
  }

  return current;
}

function buildCustomStandingHighlights(tournament: {
  format: TournamentFormat;
  formatBlueprintJson: unknown;
}) {
  if (tournament.format !== TournamentFormat.CUSTOM) {
    return new Map<number, StandingHighlight[]>();
  }

  const blueprint = normalizeFormatBlueprint(tournament.formatBlueprintJson);
  const byDivision = new Map<number, StandingHighlight[]>();
  const styleByTarget = new Map<string, (typeof CUSTOM_STANDING_HIGHLIGHT_STYLES)[number]>();
  let styleIndex = 0;

  for (const playoff of blueprint.playoffs) {
    for (const selection of playoff.selections) {
      const targetKey = playoff.type === "SINGLE" ? `${playoff.id}:main` : `${playoff.id}:${selection.targetBracket}`;

      if (!styleByTarget.has(targetKey)) {
        styleByTarget.set(targetKey, CUSTOM_STANDING_HIGHLIGHT_STYLES[styleIndex % CUSTOM_STANDING_HIGHLIGHT_STYLES.length]);
        styleIndex += 1;
      }

      const style = styleByTarget.get(targetKey)!;
      const bucket = byDivision.get(selection.divisionIndex) ?? [];
      const targetLabel =
        playoff.type === "SINGLE"
          ? playoff.name
          : selection.targetBracket === "upper"
            ? `${playoff.name} • Верхняя сетка`
            : `${playoff.name} • Нижняя сетка`;

      bucket.push({
        fromRank: selection.fromRank,
        toRank: selection.toRank,
        label: targetLabel,
        rowClass: style.rowClass,
        badgeClass: style.badgeClass,
      });
      byDivision.set(selection.divisionIndex, bucket);
    }
  }

  return byDivision;
}

function defaultRowHighlight(index: number) {
  if (index === 0) return "border-t border-primary/20 bg-primary/10";
  if (index === 1) return "border-t border-emerald-400/10 bg-emerald-400/5";
  return "border-t border-white/10";
}

function defaultRankBadge(index: number) {
  if (index === 0) return "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-semibold text-primary";
  if (index === 1) return "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400/15 px-1 text-[10px] font-semibold text-emerald-300";
  return "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/5 px-1 text-[10px] font-medium text-zinc-300";
}

function formatRankRange(fromRank: number, toRank: number) {
  return fromRank === toRank ? `${fromRank} место` : `${fromRank}–${toRank} места`;
}

function getEliminatedRanges(highlights: StandingHighlight[], totalRows: number) {
  const occupied = new Set<number>();
  for (const highlight of highlights) {
    for (let rank = highlight.fromRank; rank <= highlight.toRank; rank += 1) occupied.add(rank);
  }
  const ranges: Array<{ fromRank: number; toRank: number }> = [];
  let start: number | null = null;
  for (let rank = 1; rank <= totalRows; rank += 1) {
    if (!occupied.has(rank)) start ??= rank;
    else if (start !== null) {
      ranges.push({ fromRank: start, toRank: rank - 1 });
      start = null;
    }
  }
  if (start !== null) ranges.push({ fromRank: start, toRank: totalRows });
  return ranges;
}

function getSubmissionState({
  matchStatus,
  latestSubmission,
}: {
  matchStatus: string;
  latestSubmission?: {
    status: string;
    moderatorComment: string | null;
  };
}) {
  if (matchStatus === "DISPUTED") return { label: "Матч в споре", tone: "danger" as const };
  if (matchStatus === "CONFIRMED" || matchStatus === "FINISHED") return { label: "Счёт подтверждён", tone: "success" as const };
  if (!latestSubmission) return { label: "Ожидается результат", tone: "waiting" as const };
  if (latestSubmission.status === "PENDING") return { label: "Счёт отправлен — ждём соперника", tone: "pending" as const };
  if (latestSubmission.status === "REJECTED" && latestSubmission.moderatorComment === "AUTO_MISMATCH") {
    return { label: "Введите счёт заново", tone: "retry" as const };
  }
  if (latestSubmission.status === "DISPUTED") return { label: "Матч в споре", tone: "danger" as const };
  return { label: "Ожидается результат", tone: "waiting" as const };
}

function StickyHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="sticky top-0 z-20 border-b border-white/10 bg-[linear-gradient(180deg,rgba(18,24,34,0.98),rgba(14,18,26,0.92))] px-2 py-2 text-[10px] uppercase tracking-[0.12em] text-zinc-300 backdrop-blur-xl sm:px-4 sm:py-3 sm:text-xs sm:tracking-[0.18em]">
      {children}
    </th>
  );
}

function StandingsTable({
  rows,
  highlights = [],
}: {
  rows: LeagueRow[];
  highlights?: StandingHighlight[];
}) {
  const orderedHighlights = [...highlights].sort((a, b) => a.fromRank - b.fromRank || a.toRank - b.toRank);
  const eliminatedRanges = getEliminatedRanges(orderedHighlights, rows.length);
  return (
    <div className="min-w-0 max-w-full space-y-3">
      <div className="max-w-full overflow-hidden border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] [&_td:nth-child(1)]:px-0 [&_td:nth-child(1)]:text-center [&_td:nth-child(2)]:min-w-0 [&_td:nth-child(2)]:px-1.5 [&_td:nth-child(n+3)]:px-0 [&_th:nth-child(1)]:px-0 [&_th:nth-child(2)]:min-w-0 [&_th:nth-child(2)]:px-1.5 [&_th:nth-child(n+3)]:px-0 sm:[&_td:nth-child(2)]:px-3 sm:[&_td:nth-child(n+3)]:px-1 sm:[&_th:nth-child(2)]:px-3 sm:[&_th:nth-child(n+3)]:px-1">
        <table className="w-full table-fixed text-left text-[11px] sm:text-sm">
          <colgroup>
            <col className="w-[30px] sm:w-10" />
            <col />
            <col className="w-[28px] sm:w-10" />
            <col className="w-[28px] sm:w-10" />
            <col className="w-[28px] sm:w-10" />
            <col className="w-[28px] sm:w-10" />
            <col className="w-[34px] sm:w-12" />
            <col className="w-[34px] sm:w-14" />
          </colgroup>
          <thead>
            <tr>
              <StickyHeader>
                <div className="flex justify-center">№</div>
              </StickyHeader>
              <StickyHeader>Команда</StickyHeader>
              <StickyHeader>
                <div className="text-center">И</div>
              </StickyHeader>
              <StickyHeader>
                <div className="text-center">В</div>
              </StickyHeader>
              <StickyHeader>
                <div className="text-center">Н</div>
              </StickyHeader>
              <StickyHeader>
                <div className="text-center">П</div>
              </StickyHeader>
              <StickyHeader>
                <div className="text-center">+/-</div>
              </StickyHeader>
              <StickyHeader>
                <div className="text-center"><span className="sm:hidden">О</span><span className="hidden sm:inline">Очки</span></div>
              </StickyHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const displayRank = index + 1;
              const highlight = orderedHighlights.find((item) => displayRank >= item.fromRank && displayRank <= item.toRank);
              const isCurrentTeam = Boolean(row.isCurrentTeam);

              return (
                <tr
                  id={`standing-${row.id}`}
                  key={row.id}
                  className={cn(
                    highlight?.rowClass ?? defaultRowHighlight(index),
                    isCurrentTeam && "font-medium",
                  )}
                  title={highlight?.label}
                >
                  <td className="w-4 px-0 py-2 text-zinc-300 sm:w-5 sm:py-3">
                    <span
                      className={cn(
                        highlight?.badgeClass ?? defaultRankBadge(index),
                        isCurrentTeam && "border border-primary/45 bg-primary/15 text-primary shadow-[0_0_0_2px_rgba(33,241,168,0.12)]",
                      )}
                    >
                      {displayRank}
                    </span>
                  </td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3">
                    <div className="min-w-0">
                      <ClubPlayerLine
                        clubName={row.clubName}
                        badgePath={row.clubBadgePath}
                        playerId={row.playerId}
                        playerName={row.playerName}
                        compact
                      />
                    </div>
                  </td>
                  <td className="px-0.5 py-2 text-center text-zinc-300 sm:px-1 sm:py-3">{row.played}</td>
                  <td className="px-0.5 py-2 text-center text-zinc-300 sm:px-1 sm:py-3">{row.wins}</td>
                  <td className="px-0.5 py-2 text-center text-zinc-300 sm:px-1 sm:py-3">{row.draws}</td>
                  <td className="px-0.5 py-2 text-center text-zinc-300 sm:px-1 sm:py-3">{row.losses}</td>
                  <td
                    className={
                      row.goalDifference > 0
                        ? "px-0.5 py-2 text-center font-medium text-emerald-300 sm:px-1 sm:py-3"
                        : row.goalDifference < 0
                          ? "px-0.5 py-2 text-center font-medium text-rose-300 sm:px-1 sm:py-3"
                          : "px-0.5 py-2 text-center font-medium text-zinc-300 sm:px-1 sm:py-3"
                    }
                  >
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>
                  <td className="px-0.5 py-2 text-center font-semibold text-white sm:px-1 sm:py-3">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {orderedHighlights.length || eliminatedRanges.length ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-500">Выход из таблицы</div>
          <div className="flex flex-wrap gap-2">
            {orderedHighlights.map((highlight) => (
              <div
                key={`${highlight.label}-${highlight.fromRank}-${highlight.toRank}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${highlight.badgeClass.split(" ").find((item) => item.startsWith("bg-")) ?? "bg-primary/40"}`} />
                <span className="font-medium text-white">{formatRankRange(highlight.fromRank, highlight.toRank)}</span>
                <span className="text-zinc-400">→ {highlight.label}</span>
              </div>
            ))}

            {eliminatedRanges.map((range) => (
              <div
                key={`eliminated-${range.fromRank}-${range.toRank}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-500/70" />
                <span className="font-medium text-white">{formatRankRange(range.fromRank, range.toRank)}</span>
                <span className="text-zinc-400">→ Вылет</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyGroupSlots({ slots }: { slots: EmptyGroupSlot[] }) {
  if (!slots.length) return null;

  return (
    <div className="border-t border-white/10 bg-black/10 px-4 py-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {slots.map((slot) => (
          <div key={slot.id} className="flex items-center gap-3 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-zinc-500">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-xs font-semibold text-zinc-400">{slot.position}</span>
            <span>Свободное место</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function logTiming(label: string, start: number) {
  if (process.env.NODE_ENV === "production") return;
  console.log(`${label}: ${(performance.now() - start).toFixed(3)}ms`);
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const metadataStart = performance.now();
  const tournament = await db.tournament.findUnique({ where: { id: params.id }, select: { title: true } });
  logTiming("tournament-metadata", metadataStart);
  return tournament ? { title: tournament.title } : { title: "Турнир не найден" };
}

function canSeeTestTournaments(role?: string | null) {
  return role === "FOUNDER" || role === "ADMIN" || role === "ORGANIZER" || role === "JUDGE" || role === "TRAINEE";
}

export default async function TournamentDetailsPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ tab?: string; participantSearch?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const requestedDataTab = isPublicTournamentTabValue(searchParams?.tab) ? searchParams?.tab : "structure";
  const pageStart = performance.now();
  const sessionStart = performance.now();
  const session = await getCurrentSession().finally(() => logTiming("load-session", sessionStart));
  const viewerId = session?.user.id ?? "__anonymous__";

  const tournamentStart = performance.now();
  // Session-independent data is cached per domain (rules/participants/schedule/
  // structure) and busted by tag on mutation; see src/lib/tournament-cache.ts.
  // Session-dependent data (the viewer's own application + roster invite) stays
  // live so one viewer's data never leaks into another's cache.
  const [rules, participants, matches, stages, registrationApplications, viewerRosterMembers] = await Promise.all([
    getCachedTournamentRules(params.id),
    getCachedTournamentParticipants(params.id),
    getCachedTournamentSchedule(params.id),
    getCachedTournamentStructure(params.id),
    db.tournamentRegistrationApplication.findMany({
      where: {
        tournamentId: params.id,
        OR: [{ status: TournamentApplicationStatus.PENDING }, { userId: viewerId }],
      },
      select: { id: true, userId: true, status: true, clubSlug: true, rejectionReason: true },
    }),
    db.tournamentRegistrationMember.findMany({
      where: { tournamentId: params.id, userId: viewerId },
      select: {
        id: true,
        status: true,
        isCaptain: true,
        registration: {
          select: {
            id: true,
            teamName: true,
            clubName: true,
            rosterMembers: {
              select: {
                id: true,
                status: true,
                isCaptain: true,
                user: { select: { id: true, name: true, email: true, telegramUsername: true } },
              },
              orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
            },
          },
        },
      },
    }),
  ]);

  // Reassemble the same shape the page consumed before the query was split, so
  // downstream field-by-field access is unchanged.
  const tournament = rules
    ? {
        ...rules,
        registrationApplications,
        participants,
        rosterMembers: viewerRosterMembers,
        matches,
        stages,
      }
    : null;
  logTiming("load-tournament", tournamentStart);

  if (!tournament) {
    logTiming("tournament-page", pageStart);
    notFound();
  }

  if (tournament.isTest && !canSeeTestTournaments(session?.user.role)) {
    logTiming("tournament-page", pageStart);
    notFound();
  }

  const participantIds = new Set(tournament.participants.map((entry) => entry.id));
  const participantByEntryId = new Map(tournament.participants.map((entry) => [entry.id, entry]));
  const replacementByEntryId = new Map(
    tournament.participants
      .filter((entry) => entry.status === ParticipantStatus.REMOVED)
      .map((entry) => [entry.id, getReplacementRegistrationId(entry.notes)])
      .filter((item): item is [string, string] => Boolean(item[1] && participantIds.has(item[1]))),
  );
  const resolveActiveEntryId = (entryId?: string | null) =>
    entryId ? resolveReplacementRegistrationId(entryId, replacementByEntryId) : null;
  const resolveMatchEntry = (match: (typeof tournament.matches)[number], side: 1 | 2) => {
    const rawEntry = side === 1 ? match.participant1Entry : match.participant2Entry;
    const activeEntryId = resolveActiveEntryId(side === 1 ? match.participant1EntryId : match.participant2EntryId);
    return (activeEntryId ? participantByEntryId.get(activeEntryId) : null) ?? rawEntry;
  };
  const resolveMatchUserId = (match: (typeof tournament.matches)[number], side: 1 | 2) =>
    (side === 1 ? match.player1Id : match.player2Id) ?? resolveMatchEntry(match, side)?.userId ?? null;

  const currentUserId = session?.user?.id;
  const captainRegistrationIds = new Set(
    tournament.rosterMembers
      .filter((member) => member.isCaptain && member.status === "ACCEPTED")
      .map((member) => member.registration.id),
  );
  const isCurrentUserMatch = (match: (typeof tournament.matches)[number]) =>
    Boolean(
      currentUserId &&
        (resolveMatchUserId(match, 1) === currentUserId ||
          resolveMatchUserId(match, 2) === currentUserId ||
          (tournament.captainsCreateTeamMatches &&
            (captainRegistrationIds.has(match.participant1EntryId ?? "") || captainRegistrationIds.has(match.participant2EntryId ?? "")))),
    );

  const myMatchIds = currentUserId
    ? tournament.matches
        .filter(isCurrentUserMatch)
        .map((m) => m.id)
    : [];

  const secondaryStart = performance.now();
  const [currentUser, rawSubmissions, availableClubs] = await Promise.all([
    currentUserId
      ? db.user.findUnique({
          where: { id: currentUserId },
          select: {
            telegramId: true,
            telegramUsername: true,
            reliabilityScore: true,
            reliabilityRestrictedUntil: true,
          },
        })
      : Promise.resolve(null),
    myMatchIds.length
      ? db.matchResultSubmission.findMany({
          where: { matchId: { in: myMatchIds } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            matchId: true,
            submittedById: true,
            status: true,
            moderatorComment: true,
            player1Score: true,
            player2Score: true,
            player1PenaltyScore: true,
            player2PenaltyScore: true,
          },
        })
      : Promise.resolve([]),
    getAvailableClubs(),
  ]);
  logTiming("load-secondary", secondaryStart);

  const processStart = performance.now();
  const submissionsByMatchId = new Map<string, typeof rawSubmissions>();
  for (const sub of rawSubmissions) {
    const arr = submissionsByMatchId.get(sub.matchId) ?? [];
    arr.push(sub);
    submissionsByMatchId.set(sub.matchId, arr);
  }

  const clubsBySlug = new Map(availableClubs.map((club) => [club.slug, club]));

  const activeParticipants = tournament.participants.filter(
    (entry) => entry.status !== ParticipantStatus.REMOVED && entry.status !== ParticipantStatus.REJECTED,
  );
  const currentRosterMembership = tournament.rosterMembers[0] ?? null;
  const currentRegistrationId =
    (currentRosterMembership?.status === "ACCEPTED" ? currentRosterMembership.registration.id : null) ??
    activeParticipants.find((entry) => entry.userId === currentUserId)?.id ??
    null;
  const participantSearch = (searchParams?.participantSearch ?? "").trim();
  const normalizedParticipantSearch = normalizeSearchText(participantSearch);
  const participantSearchMatches = (entry: (typeof activeParticipants)[number]) => {
    if (!normalizedParticipantSearch) return true;

    const playerName = getPlayerDisplayName(entry.user);
    const clubName = resolveClubName(entry, clubsBySlug, playerName);
    const rosterMembers = entry.rosterMembers.flatMap((member) => [getPlayerDisplayName(member.user), member.user.telegramUsername]);
    const searchableValues = [
      playerName,
      entry.user.telegramUsername,
      entry.clubName,
      entry.clubSlug,
      entry.teamName,
      clubName,
      ...rosterMembers,
    ];

    return searchableValues.some((value) => normalizeSearchText(value).includes(normalizedParticipantSearch));
  };
  const filteredParticipants = activeParticipants.filter(participantSearchMatches);
  const hasFreeSlots = activeParticipants.length < tournament.maxParticipants;
  const isRegistrationOpen = tournament.status === TournamentStatus.REGISTRATION_OPEN;
  const isLoggedIn = Boolean(currentUserId);
  const alreadyRegistered = !!currentUserId && activeParticipants.some((entry) => entry.userId === currentUserId);
  const currentApplication = currentUserId
    ? tournament.registrationApplications.find((application) => application.userId === currentUserId) ?? null
    : null;
  const hasPendingApplication = currentApplication?.status === TournamentApplicationStatus.PENDING;
  const needsTelegramConnection = Boolean(isLoggedIn && !currentUser?.telegramId);
  const needsTelegramUsername = Boolean(isLoggedIn && currentUser?.telegramId && !hasPublicTelegramUsername(currentUser.telegramUsername));
  const needsTelegram = Boolean(isLoggedIn && !hasTelegramRegistrationContact(currentUser));
  const reliabilityRestrictedUntil =
    currentUser?.reliabilityRestrictedUntil && currentUser.reliabilityRestrictedUntil > new Date() ? currentUser.reliabilityRestrictedUntil : null;
  const isReliabilityRestrictedForRegistration = Boolean(
    currentUser && (currentUser.reliabilityScore < RELIABILITY_REGISTRATION_THRESHOLD || reliabilityRestrictedUntil),
  );
  const reliabilityRestrictionText = currentUser && isReliabilityRestrictedForRegistration
    ? reliabilityRestrictedUntil
      ? `Регистрация временно ограничена до ${new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(reliabilityRestrictedUntil)}. Надежность: ${currentUser.reliabilityScore}/100.`
      : `Регистрация временно ограничена: надежность ${currentUser.reliabilityScore}/100. Минимум для участия — ${RELIABILITY_REGISTRATION_THRESHOLD}.`
    : null;
  const reliabilityWarningText = currentUser && !isReliabilityRestrictedForRegistration && currentUser.reliabilityScore < 80
    ? `Надежность ${currentUser.reliabilityScore}/100 ниже стабильного уровня. Участвовать можно, но техпоражения могут ограничить регистрацию в будущие турниры.`
    : null;
  const canRegister = isLoggedIn && isRegistrationOpen && hasFreeSlots && !alreadyRegistered && !hasPendingApplication && !needsTelegram && !isReliabilityRestrictedForRegistration;
  const canCancelRegistration =
    isLoggedIn &&
    alreadyRegistered &&
    tournament.status !== TournamentStatus.IN_PROGRESS &&
    tournament.status !== TournamentStatus.COMPLETED;

  const leagueStage = tournament.stages.find((stage) => stage.type === StageType.LEAGUE);
  const participantsByGroupId = new Map<string, typeof tournament.participants>();

  for (const participant of tournament.participants) {
    if (!participant.groupId) continue;
    const bucket = participantsByGroupId.get(participant.groupId) ?? [];
    bucket.push(participant);
    participantsByGroupId.set(participant.groupId, bucket);
  }

  for (const bucket of Array.from(participantsByGroupId.values())) {
    bucket.sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999));
  }

  // Copy before sort: tournament.matches is the shared cached array (mutating it in place would corrupt the cache).
  const visibleMatches = [...tournament.matches].sort(
    (a, b) =>
      (a.stage?.orderIndex ?? 999) - (b.stage?.orderIndex ?? 999) ||
      (a.group?.orderIndex ?? 0) - (b.group?.orderIndex ?? 0) ||
      a.round - b.round ||
      a.matchNumber - b.matchNumber ||
      scheduleMatchTime(a) - scheduleMatchTime(b),
  );
  const captainMatchSlotLabels = buildCaptainTeamMatchSlotLabels(visibleMatches);
  const scheduleSections = buildScheduleSections(visibleMatches);

  const getMatchDeadline = (match: (typeof visibleMatches)[number]) => match.stage?.deadlines.find((item) => item.round === match.round)?.deadlineAt ?? null;
  const isMatchOpenForScore = (match: (typeof visibleMatches)[number]) =>
    Boolean(getMatchDeadline(match)) &&
    match.status !== MatchStatus.CONFIRMED &&
    match.status !== MatchStatus.FINISHED &&
    match.status !== MatchStatus.DISPUTED &&
    match.status !== MatchStatus.FORFEIT &&
    match.status !== MatchStatus.CANCELLED;
  const isPlayedMatch = (match: (typeof visibleMatches)[number]) =>
    match.status === MatchStatus.CONFIRMED ||
    match.status === MatchStatus.FINISHED ||
    match.status === MatchStatus.FORFEIT ||
    match.status === MatchStatus.CANCELLED;
  const myMatchSortGroup = (match: (typeof visibleMatches)[number]) => {
    if (isMatchOpenForScore(match)) return 0;
    if (isPlayedMatch(match)) return 1;
    return 2;
  };

  const myMatches = currentUserId
    ? visibleMatches.filter(isCurrentUserMatch)
    : [];

  const myMatchesWithSubmissions = myMatches
    .map((match) => ({
      ...match,
      submissions: submissionsByMatchId.get(match.id) ?? [],
    }))
    .sort((a, b) => {
      const captainMatchOrder = compareCaptainAssignedTeamMatches(a, b, currentRegistrationId);
      if (captainMatchOrder !== null) return captainMatchOrder;

      return (
        myMatchSortGroup(a) - myMatchSortGroup(b) ||
        scheduleMatchTime(a) - scheduleMatchTime(b) ||
        a.matchNumber - b.matchNumber
      );
    });

  const leagueMatches = leagueStage
    ? tournament.matches.filter((match) => match.stageId === leagueStage.id)
    : tournament.matches.filter((match) => !match.groupId && !match.bracketId);

  const leagueTable =
    tournament.format === TournamentFormat.ROUND_ROBIN || tournament.format === TournamentFormat.LEAGUE
      ? buildPublicLeagueTable(tournament.participants, leagueMatches, clubsBySlug)
      : [];

  const takenClubSlugs = [
    ...activeParticipants.map((entry) => entry.clubSlug),
    ...tournament.registrationApplications
      .filter((application) => application.status === TournamentApplicationStatus.PENDING)
      .map((application) => application.clubSlug),
  ].filter(Boolean) as string[];
  const customStandingHighlights = buildCustomStandingHighlights(tournament);
  const structureOptions: TournamentStageOption[] = tournament.stages.map((stage) => ({
    id: stage.id,
    title: stage.name?.trim() || (stage.type === StageType.PLAYOFF ? "Плей-офф" : stage.type === StageType.LEAGUE ? "Лига" : "Групповой этап"),
    caption:
      stage.type === StageType.PLAYOFF
        ? pluralRu(stage.roundsCount ?? 0, "раунд", "раунда", "раундов")
        : stage.groups.length
          ? pluralRu(stage.groups.length, "группа", "группы", "групп")
          : "Общая таблица",
    state: stagePresentationState(stage.status),
  }));
  const currentStage = tournament.stages.find((stage) => stage.status === "ACTIVE") ?? tournament.stages.find((stage) => stage.status !== "DRAFT") ?? tournament.stages[0];
  const participantClubMap = Object.fromEntries(
    tournament.participants.map((entry) => [
      entry.userId,
      {
        clubName: resolveClubName(entry, clubsBySlug, getPlayerDisplayName(entry.user)),
        clubBadgePath: resolveClubBadgePath(entry, clubsBySlug),
      },
    ]),
  );
  const resolveMatchSide = (match: (typeof visibleMatches)[number], side: 1 | 2) => {
    const player = side === 1 ? match.player1 : match.player2;
    const entry = resolveMatchEntry(match, side);
    const explicitPlayerId = side === 1 ? match.player1Id : match.player2Id;
    const isUnassignedCaptainMatch = match.isCaptainAssignedTeamMatch && !explicitPlayerId;
    const playerId = isUnassignedCaptainMatch ? null : explicitPlayerId ?? entry?.userId ?? null;
    const playerName = player
      ? getPlayerDisplayName(player)
      : entry?.user
      ? getPlayerDisplayName(entry.user)
      : side === 1
        ? "Игрок 1"
        : "Игрок 2";
    const mappedClub = playerId ? participantClubMap[playerId] : null;

    return {
      playerId,
      playerName,
      showPlayerName: !isUnassignedCaptainMatch,
      clubName: mappedClub?.clubName ?? (entry ? resolveClubName(entry, clubsBySlug, playerName) : null),
      clubBadgePath: mappedClub?.clubBadgePath ?? (entry ? resolveClubBadgePath(entry, clubsBySlug) : null),
    };
  };
  const scheduleViewSections = scheduleSections.map((section) => ({
    key: section.key,
    title: section.title,
    deadlineLabel: section.deadlineAt ? formatDate(section.deadlineAt) : null,
    deadlineAt: section.deadlineAt ? new Date(section.deadlineAt).toISOString() : null,
    allMatchesPlayed: section.matches.length > 0 && section.matches.every(isPlayedMatch),
    matches: section.matches.map((match) => {
      const sideOne = resolveMatchSide(match, 1);
      const sideTwo = resolveMatchSide(match, 2);
      const captainSlotLabel = captainMatchSlotLabels.get(match.id);

      return {
        id: match.id,
        roundKey: [match.stage?.id ?? "stage", match.round].join(":"),
        roundLabel: section.title,
        roundSort: match.round,
        matchNumber: match.matchNumber,
        groupId: match.group?.id ?? null,
        groupName: match.group?.name ?? null,
        groupSort: match.group?.orderIndex ?? 999,
        matchLabel: match.isTeamCaptainTiebreak
          ? "Решающий матч капитанов"
          : captainSlotLabel
            ? `Матч ${match.matchNumber} • ${captainSlotLabel}`
            : `Матч ${match.matchNumber}`,
        scoreLabel: match.player1Score !== null && match.player2Score !== null ? `${match.player1Score} - ${match.player2Score}` : "VS",
        sideOne,
        sideTwo,
      };
    }),
  }));
  const currentGroupId = currentRegistrationId
    ? activeParticipants.find((entry) => entry.id === currentRegistrationId)?.groupId ?? null
    : null;
  const showRosterTab = tournament.participantMode !== "SINGLE";
  const tournamentTabs = getTournamentTabs(tournament.participantMode);
  const requestedTournamentTab = searchParams?.tab;
  const defaultTournamentTab =
    isPublicTournamentTabValue(requestedTournamentTab) && (requestedTournamentTab !== "roster" || showRosterTab)
      ? requestedTournamentTab
      : requestedTournamentTab === "roster"
        ? "participants"
        : "structure";
  const renderRosterCards = (entries: typeof activeParticipants) => (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map((entry) => {
        const playerName = getPlayerDisplayName(entry.user);
        const rosterTitle = resolveClubName(entry, clubsBySlug, playerName);
        const rosterBadge = resolveClubBadgePath(entry, clubsBySlug);
        const members = entry.rosterMembers.filter((member) => member.status === "PENDING" || member.status === "ACCEPTED");

        return (
          <Card key={entry.id} className="min-w-0 overflow-hidden p-0">
            <div className="flex min-w-0 items-center gap-3 border-b border-white/10 px-4 py-4">
              {rosterBadge ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/25">
                  <Image src={rosterBadge} alt={rosterTitle} width={48} height={48} className="h-full w-full object-contain p-1.5" />
                </div>
              ) : null}
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                  {tournament.participantMode === "TEAM" ? "Команда" : "Состав"}
                </div>
                <div className="mt-1 max-w-full truncate text-lg font-semibold text-white">{rosterTitle}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {members.filter((member) => member.status === "ACCEPTED").length}/{tournament.rosterSize} игроков
                </div>
              </div>
            </div>

            <div className="grid gap-2 p-3">
              {members.map((member) => {
                const memberName = getPlayerDisplayName(member.user);
                const telegramProfile = getTelegramProfileLinks(member.user);

                return (
                  <div key={member.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{memberName}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {member.isCaptain ? "Капитан · " : ""}
                        {member.status === "ACCEPTED" ? "принято" : member.status === "PENDING" ? "ожидает" : "отклонено"}
                      </div>
                    </div>

                    {telegramProfile ? (
                      <TelegramProfileLink
                        {...telegramProfile}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Открыть Telegram ${memberName}`}
                        className="flex h-11 min-w-0 shrink-0 items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-500/10 px-3 text-xs font-semibold text-sky-100 transition hover:border-sky-300/40 hover:bg-sky-500/20"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">@{telegramProfile.username}</span>
                      </TelegramProfileLink>
                    ) : (
                      <span className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
                        без TG
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
  const currentRosterCards = currentRosterMembership
    ? renderRosterCards(activeParticipants.filter((entry) => entry.id === currentRosterMembership.registration.id))
    : (
      <TournamentEmptyState title="Состав ещё не создан" description="Он появится после регистрации команды или принятия приглашения." />
    );
  const allRosterCards = renderRosterCards(filteredParticipants);
  const primaryAction = canRegister ? (
    <RegisterTournamentButton
      tournamentId={tournament.id}
      clubSelectionMode={tournament.clubSelectionMode ?? ClubSelectionMode.ADMIN_RANDOM}
      participantMode={tournament.participantMode}
      rosterSize={tournament.rosterSize}
      requireLineupPhoto={tournament.requireLineupPhoto}
      lineupPhotoExampleUrl={tournament.lineupPhotoExampleUrl}
      clubs={availableClubs}
      takenClubSlugs={takenClubSlugs}
    />
  ) : canCancelRegistration ? (
    <CancelTournamentRegistrationButton tournamentId={tournament.id} />
  ) : hasPendingApplication ? (
    <Button size="lg" disabled className="gap-2 border-amber-300/30 text-amber-100">
      <Clock3 className="h-4 w-4" />
      Заявка на проверке
    </Button>
  ) : alreadyRegistered ? null : isRegistrationOpen && !isLoggedIn ? (
    <Button size="lg" asChild><a href={`/login?callbackUrl=/tournaments/${tournament.id}`}>Войти и участвовать</a></Button>
  ) : isRegistrationOpen && needsTelegramConnection ? (
    <Button size="lg" asChild><a href="/dashboard/security">Привязать Telegram</a></Button>
  ) : isRegistrationOpen ? (
    <Button size="lg" disabled>
      {needsTelegramUsername
        ? "Нужен публичный @username"
        : reliabilityRestrictionText
          ? `Надёжность ${currentUser?.reliabilityScore ?? 0}/100`
          : hasFreeSlots
            ? "Регистрация недоступна"
            : "Мест больше нет"}
    </Button>
  ) : (
    <Button size="lg" asChild><a href={`/tournaments/${tournament.id}?tab=matches`}>Смотреть расписание</a></Button>
  );

  logTiming("load-process", processStart);
  logTiming(`tournament-page[tab=${requestedDataTab}]`, pageStart);

  return (
    <div className="page-shell space-y-8">
      <div className="hidden md:block">
        <TournamentHero
          title={tournament.title}
          description={tournament.description}
          statusLabel={tournamentStatusLabel[tournament.status]}
          statusVariant={tournamentStatusVariant[tournament.status]}
          formatLabel={publicParticipantModeLabel(tournament.participantMode, tournament.rosterSize)}
          playoffLabel={tournament.playoffType ? playoffTypeLabel[tournament.playoffType] ?? tournament.playoffType : null}
          startLabel={formatDate(tournament.startsAt)}
          registrationDeadlineLabel={formatDate(tournament.registrationEndsAt)}
          stageLabel={currentStage?.name ?? "Ожидает публикации"}
          participantsLabel={`${activeParticipants.length} / ${tournament.maxParticipants}`}
          prizePool={tournament.prizePool}
          coverUrl={tournament.coverImage ? `/api/tournaments/${tournament.id}/cover?w=1280&h=720&q=86` : null}
          primaryAction={primaryAction}
          secondaryAction={null}
          tournamentId={tournament.id}
        />
      </div>

      <div className="md:hidden [&>a]:w-full [&>button]:w-full [&_button]:w-full">
        {primaryAction}
      </div>

      {reliabilityWarningText ? <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm leading-6 text-amber-100">{reliabilityWarningText}</div> : null}

      <TournamentNavigation tabs={tournamentTabs} initialValue={defaultTournamentTab}>

        {defaultTournamentTab === "structure" ? <TournamentTabContent>
          {structureOptions.length ? (
            <TournamentStageSwitcher options={structureOptions}>
              {tournament.stages.map((stage) => {
                if (stage.type === StageType.PLAYOFF) {
                  return (
                    <BracketView key={stage.id} matches={tournament.matches.filter((match) => match.stageId === stage.id)} clubsByUserId={participantClubMap} currentUserId={currentUserId} />
                  );
                }

                if (stage.groups.length) {
                  const orderedGroups = prioritizeCurrentGroup(stage.groups, currentGroupId);
                  return (
                    <div key={stage.id} className="space-y-4">
                      {orderedGroups.map((group) => {
                    const groupMatches = tournament.matches.filter((match) => match.groupId === group.id);
                    const groupMembers = participantsByGroupId.get(group.id) ?? [];
                    const activeMembers = groupMembers.filter((member) => member.status === ParticipantStatus.CONFIRMED);
                    const groupRows = buildPublicLeagueTable(groupMembers, groupMatches, clubsBySlug, stage).map((row) => ({ ...row, isCurrentTeam: row.id === currentUserId }));
                    const groupCapacity = group.capacity ?? stage.participantsPerGroup ?? 0;
                    const isCurrentGroup = group.id === currentGroupId;
                    const emptySlots = Array.from({ length: Math.max(groupCapacity - activeMembers.length, 0) }, (_, index) => ({ id: `${group.id}-slot-${index + 1}`, position: activeMembers.length + index + 1 }));
                        return (
                      <Card
                        key={group.id}
                        className={cn(
                          "min-w-0 overflow-hidden p-0",
                          isCurrentGroup && "border-primary/30 bg-primary/[0.05] shadow-[0_0_0_1px_rgba(33,241,168,0.1)]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate font-semibold text-white">{group.name}</h3>
                            {isCurrentGroup ? (
                              <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                                Моя группа
                              </span>
                            ) : null}
                          </div>
                          <span className="text-xs text-zinc-500">{groupRows.length} / {groupCapacity || "—"}</span>
                        </div>
                        <div className="p-3 sm:p-4">
                          {groupRows.length ? <StandingsTable rows={groupRows} highlights={customStandingHighlights.get(group.orderIndex) ?? []} /> : <TournamentEmptyState title="Группа ещё не сформирована" description="Участники появятся после распределения по группам." />}
                        </div>
                        <EmptyGroupSlots slots={emptySlots} />
                      </Card>
                        );
                      })}
                    </div>
                  );
                }

                const stageMatches = tournament.matches.filter((match) => match.stageId === stage.id);
                const stageTable = (stage.type === StageType.LEAGUE ? buildPublicLeagueTable(tournament.participants, stageMatches, clubsBySlug, stage) : leagueTable)
                  .map((row) => ({ ...row, isCurrentTeam: row.id === currentUserId }));
                return (
                  <Card key={stage.id} className="min-w-0 overflow-hidden p-0">
                    <div className="border-b border-white/10 px-5 py-4 font-semibold text-white">Таблица лиги</div>
                    <div className="p-3 sm:p-4">{stageTable.length ? <StandingsTable rows={stageTable} /> : <TournamentEmptyState title="Нет данных таблицы" description="Статистика появится после первых завершённых матчей." />}</div>
                  </Card>
                );
              })}
            </TournamentStageSwitcher>
          ) : (
            <TournamentEmptyState title="Структура ещё не опубликована" description="Этапы, группы и сетка появятся здесь после формирования турнира." />
          )}
        </TournamentTabContent> : null}

        {defaultTournamentTab === "matches" ? <TournamentTabContent>
          <TournamentScheduleView sections={scheduleViewSections} />
        </TournamentTabContent> : null}

        {defaultTournamentTab === "my-matches" ? <TournamentTabContent>
          <div className="grid gap-4">
            {!currentUserId ? (
              <TournamentEmptyState title="Войдите, чтобы увидеть свои матчи" description="После входа здесь будут собраны ваши ближайшие и завершённые встречи." action={<Button asChild><a href={`/login?callbackUrl=/tournaments/${tournament.id}?tab=my-matches`}>Войти</a></Button>} />
            ) : myMatchesWithSubmissions.length ? (
              myMatchesWithSubmissions.map((match) => {
                const sideOne = resolveMatchSide(match, 1);
                const sideTwo = resolveMatchSide(match, 2);
                const player1LatestSubmission = match.submissions.find((submission) => submission.submittedById === sideOne.playerId);
                const player2LatestSubmission = match.submissions.find((submission) => submission.submittedById === sideTwo.playerId);
                const matchDeadline = getMatchDeadline(match);
                const waitingForOpponent = match.submissions.some((submission) => submission.submittedById === currentUserId && submission.status === "PENDING");
                const isMatchPlayer = sideOne.playerId === currentUserId || sideTwo.playerId === currentUserId;
                const canSubmitScore = isMatchPlayer && isMatchOpenForScore(match) && !waitingForOpponent;
                const homeEntry = resolveMatchEntry(match, 1);
                const awayEntry = resolveMatchEntry(match, 2);
                const homeRosterEntry = homeEntry ? participantByEntryId.get(homeEntry.id) ?? null : null;
                const awayRosterEntry = awayEntry ? participantByEntryId.get(awayEntry.id) ?? null : null;
                const captainSlotLabel = captainMatchSlotLabels.get(match.id);
                const deadlineLabel = matchDeadline ? `Дедлайн: ${formatDate(matchDeadline)}` : "Дедлайн не задан";
                const matchMeta = match.isTeamCaptainTiebreak
                  ? `Решающий матч капитанов • ${deadlineLabel}`
                  : captainSlotLabel
                    ? `${captainSlotLabel} • ${deadlineLabel}`
                    : deadlineLabel;
                const canAssignTeamMatch =
                  tournament.captainsCreateTeamMatches &&
                  match.isCaptainAssignedTeamMatch &&
                  !match.player1Id &&
                  !match.player2Id &&
                  match.status === MatchStatus.PENDING &&
                  currentRosterMembership?.isCaptain &&
                  currentRosterMembership.status === "ACCEPTED" &&
                  match.participant1EntryId === currentRosterMembership.registration.id;
                const isTeamCaptainPlayoffMatch =
                  Boolean(match.bracketId) &&
                  match.isCaptainAssignedTeamMatch &&
                  !match.isTeamCaptainTiebreak &&
                  !match.isPenaltyTiebreak;
                const isSingleLegPlayoffMatch =
                  Boolean(match.bracketId) &&
                  !match.isPenaltyTiebreak &&
                  !match.isCaptainAssignedTeamMatch &&
                  (match.playoffBracket?.legsCount ?? 1) <= 1;

                return (
                  <div key={match.id}>
                  <MyMatchCard
                    id={match.id}
                    meta={matchMeta}
                    isConfirmed={match.status === MatchStatus.CONFIRMED || match.status === MatchStatus.FINISHED}
                    confirmedPlayer1Score={match.player1Score}
                    confirmedPlayer2Score={match.player2Score}
                    confirmedPlayer1PenaltyScore={match.player1PenaltyScore}
                    confirmedPlayer2PenaltyScore={match.player2PenaltyScore}
                    canSubmit={canSubmitScore}
                    requiresPenaltyOnDraw={
                      match.isTeamCaptainTiebreak || isTeamCaptainPlayoffMatch || isSingleLegPlayoffMatch
                    }
                    waitingForOpponent={waitingForOpponent}
                    attemptsLeft={Math.max(
                      0,
                      3 -
                        Math.floor(
                          match.submissions.filter(
                            (submission) => submission.status === "REJECTED" && submission.moderatorComment === "AUTO_MISMATCH",
                          ).length / 2,
                        ),
                    )}
                    helperText={
                      match.status === MatchStatus.DISPUTED
                        ? "Матч переведён в спор. Теперь результат выставляет администрация."
                        : !matchDeadline
                          ? "Дедлайн для этого тура не задан. Счёт можно отправить только после назначения дедлайна."
                          : "Оба игрока должны ввести один и тот же счёт. Если результаты не совпадут три раза, матч уйдёт в спор."
                    }
                    player1Id={sideOne.playerId}
                    player2Id={sideTwo.playerId}
                    player1Name={sideOne.playerName}
                    player2Name={sideTwo.playerName}
                    showPlayer1Name={sideOne.showPlayerName}
                    showPlayer2Name={sideTwo.showPlayerName}
                    player1ClubName={sideOne.clubName}
                    player2ClubName={sideTwo.clubName}
                    player1ClubBadgePath={sideOne.clubBadgePath}
                    player2ClubBadgePath={sideTwo.clubBadgePath}
                    player1SubmissionState={getSubmissionState({
                      matchStatus: match.status,
                      latestSubmission: player1LatestSubmission
                        ? {
                            status: player1LatestSubmission.status,
                            moderatorComment: player1LatestSubmission.moderatorComment,
                          }
                        : undefined,
                    })}
                    player1SubmittedScore={
                      player1LatestSubmission
                        ? {
                            player1Score: player1LatestSubmission.player1Score,
                            player2Score: player1LatestSubmission.player2Score,
                            player1PenaltyScore: player1LatestSubmission.player1PenaltyScore,
                            player2PenaltyScore: player1LatestSubmission.player2PenaltyScore,
                          }
                        : undefined
                    }
                    player2SubmissionState={getSubmissionState({
                      matchStatus: match.status,
                      latestSubmission: player2LatestSubmission
                        ? {
                            status: player2LatestSubmission.status,
                            moderatorComment: player2LatestSubmission.moderatorComment,
                          }
                        : undefined,
                    })}
                    player2SubmittedScore={
                      player2LatestSubmission
                        ? {
                            player1Score: player2LatestSubmission.player1Score,
                            player2Score: player2LatestSubmission.player2Score,
                            player1PenaltyScore: player2LatestSubmission.player1PenaltyScore,
                            player2PenaltyScore: player2LatestSubmission.player2PenaltyScore,
                          }
                        : undefined
                    }
                    disputeHref="/contacts"
                    isDisputed={match.status === MatchStatus.DISPUTED}
                  />
                  {canAssignTeamMatch && homeRosterEntry && awayRosterEntry ? (
                    <TeamMatchAssignment
                      tournamentId={tournament.id}
                      matchId={match.id}
                      homePlayers={homeRosterEntry.rosterMembers
                        .filter((member) => member.status === "ACCEPTED")
                        .map((member) => ({ id: member.user.id, name: getPlayerDisplayName(member.user) }))}
                      awayPlayers={awayRosterEntry.rosterMembers
                        .filter((member) => member.status === "ACCEPTED")
                        .map((member) => ({ id: member.user.id, name: getPlayerDisplayName(member.user) }))}
                    />
                  ) : null}
                  </div>
                );
              })
            ) : (
              <TournamentEmptyState title="Личных матчей пока нет" description="Встречи появятся после публикации расписания или формирования сетки." />
            )}
          </div>
        </TournamentTabContent> : null}

        {showRosterTab && defaultTournamentTab === "roster" ? (
          <TournamentTabContent>
            <div className="grid gap-4">
              <RosterManager
                tournamentId={tournament.id}
                participantMode={tournament.participantMode}
                rosterSize={tournament.rosterSize}
                tournamentStatus={tournament.status}
                currentMembership={currentRosterMembership}
              />
              {currentRosterCards}
            </div>
          </TournamentTabContent>
        ) : null}

        {defaultTournamentTab === "participants" ? <TournamentTabContent>
          <div className="space-y-4">
            <form aria-label="Поиск участников" className="grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <input type="hidden" name="tab" value="participants" />
              <label className="relative min-w-0">
                <span className="sr-only">Клуб или ник участника</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                <input type="search" name="participantSearch" defaultValue={participantSearch} placeholder="Найти по клубу или нику" className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm font-medium text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/45 focus:bg-black/30" />
              </label>
              <Button type="submit" variant="secondary" className="h-11 rounded-xl px-4">
                Найти
              </Button>
              {participantSearch ? (
                <a
                  href={`/tournaments/${tournament.id}?tab=participants`}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                >
                  Сбросить
                </a>
              ) : null}
            </form>

            {participantSearch ? (
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                Найдено: {filteredParticipants.length} из {activeParticipants.length}
              </div>
            ) : null}

            {filteredParticipants.length ? (
              showRosterTab ? (
                allRosterCards
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredParticipants.map((entry) => {
                const telegramProfile = getTelegramProfileLinks(entry.user);
                const playerName = getPlayerDisplayName(entry.user);

                return (
                  <Card key={entry.id} className="flex min-w-0 items-center justify-between gap-3 p-4">
                    <ClubPlayerLine
                      playerId={entry.user.id}
                      playerName={playerName}
                      clubName={resolveClubName(entry, clubsBySlug, playerName)}
                      badgePath={resolveClubBadgePath(entry, clubsBySlug)}
                    />

                    {telegramProfile ? (
                      <TelegramProfileLink
                        {...telegramProfile}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Открыть Telegram ${playerName}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-500/10 text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/20 hover:text-white"
                      >
                        <Send className="h-4 w-4" />
                      </TelegramProfileLink>
                    ) : (
                      <button
                        type="button"
                        disabled
                        aria-label="Telegram не указан"
                        className="flex h-11 w-11 shrink-0 cursor-default items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-600"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                  </Card>
                );
                  })}
                </div>
              )
            ) : (
              <TournamentEmptyState title="Участники не найдены" description="Измените запрос или сбросьте фильтр, чтобы увидеть весь список." />
            )}
          </div>
        </TournamentTabContent> : null}

        {defaultTournamentTab === "rules" ? <TournamentTabContent>
          {tournament.rules.trim() ? <Card className="p-5 sm:p-7"><h2 className="text-xl font-bold text-white">Правила турнира</h2><div className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-zinc-300 sm:text-base">{tournament.rules}</div></Card> : <TournamentEmptyState title="Правила ещё не опубликованы" description="Организатор добавит регламент до начала турнира." />}
        </TournamentTabContent> : null}
      </TournamentNavigation>
    </div>
  );
}
