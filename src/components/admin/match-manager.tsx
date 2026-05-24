"use client";

import { MatchStatus, StageType } from "@prisma/client";
import { CalendarClock, ExternalLink, GripVertical, MessageSquare, Search, Shield, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchStatusLabel, matchStatusVariant } from "@/lib/admin-display";
import { cn } from "@/lib/utils";

type ParticipantOption = {
  id: string;
  userId: string;
  clubName: string | null;
  clubBadgePath: string | null;
  user: {
    name: string | null;
  };
};

type MatchItem = {
  id: string;
  round: number;
  matchNumber: number;
  status: MatchStatus;
  scheduledAt: string | null;
  player1Score: number | null;
  player2Score: number | null;
  notes: string | null;
  player1Id: string | null;
  player2Id: string | null;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
  player1: { name: string | null } | null;
  player2: { name: string | null } | null;
  bracketId?: string | null;
  stage?: { name: string | null; type: StageType } | null;
  group?: { name: string } | null;
};

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isTourMatch(match: MatchItem) {
  return match.stage?.type === StageType.GROUP_STAGE || match.stage?.type === StageType.LEAGUE || Boolean(match.group);
}

function roundLabel(match: MatchItem) {
  return `${isTourMatch(match) ? "РўСѓСЂ" : "Р Р°СѓРЅРґ"} ${match.round}`;
}

function roundSectionLabel(matches: MatchItem[], round: number) {
  const hasTours = matches.some(isTourMatch);
  const hasRounds = matches.some((match) => !isTourMatch(match));

  if (hasTours && !hasRounds) return `РўСѓСЂ ${round}`;
  if (!hasTours && hasRounds) return `Р Р°СѓРЅРґ ${round}`;
  return `РўСѓСЂ/СЂР°СѓРЅРґ ${round}`;
}

function scoreFromInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const score = Number(trimmed);
  return Number.isFinite(score) ? score : null;
}

function participantName(participant?: ParticipantOption | null) {
  return participant?.user.name?.trim() || "РРіСЂРѕРє РЅРµ РІС‹Р±СЂР°РЅ";
}

function participantClubName(participant?: ParticipantOption | null) {
  return participant?.clubName?.trim() || "РљР»СѓР± РЅРµ РЅР°Р·РЅР°С‡РµРЅ";
}

function TeamBadge({ participant }: { participant?: ParticipantOption | null }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 text-primary">
      {participant?.clubBadgePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={participant.clubBadgePath} alt={participantClubName(participant)} className="h-full w-full object-contain p-1" />
      ) : (
        <Shield className="h-4 w-4" />
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{children}</div>;
}

function MatchSideSelect({
  label,
  value,
  placeholder,
  participants,
  selected,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  participants: ParticipantOption[];
  selected?: ParticipantOption | null;
  onChange: (participantId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 transition hover:border-primary/25">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <TeamBadge participant={selected} />
        <div className="min-w-0 flex-1">
          <FieldLabel>{label}</FieldLabel>
          <div className="truncate text-sm font-semibold leading-tight text-white">{participantName(selected)}</div>
          <div className="truncate text-xs leading-tight text-zinc-500">{participantClubName(selected)}</div>
        </div>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 text-sm text-white outline-none transition focus:border-primary/60"
      >
        <option value="">{placeholder}</option>
        {participants.map((participant) => (
          <option key={participant.id} value={participant.id}>
            {participantClubName(participant)} В· {participant.user.name ?? participant.id}
          </option>
        ))}
      </select>
    </div>
  );
}

export function MatchManager({
  tournamentId,
  matches,
  participants,
}: {
  tournamentId: string;
  matches: MatchItem[];
  participants: ParticipantOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draggedMatchId, setDraggedMatchId] = useState<string | null>(null);
  const [orderedMatches, setOrderedMatches] = useState(matches);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roundFilter, setRoundFilter] = useState<string>("all");

  const participantById = useMemo(() => new Map(participants.map((participant) => [participant.id, participant])), [participants]);

  useEffect(() => {
    setOrderedMatches(matches);
  }, [matches]);

  const rounds = useMemo(() => Array.from(new Set(orderedMatches.map((match) => match.round))).sort((a, b) => a - b), [orderedMatches]);

  const visibleMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orderedMatches.filter((match) => {
      const haystack = [
        match.player1?.name,
        match.player2?.name,
        match.stage?.name,
        match.group?.name,
        match.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (statusFilter !== "all" && match.status !== statusFilter) return false;
      if (roundFilter !== "all" && String(match.round) !== roundFilter) return false;
      if (normalized && !haystack.includes(normalized) && !`match ${match.matchNumber}`.includes(normalized)) return false;
      return true;
    });
  }, [orderedMatches, query, statusFilter, roundFilter]);

  const patchLocalMatch = (matchId: string, payload: Record<string, unknown>) => {
    setOrderedMatches((current) =>
      current.map((match) => {
        if (match.id !== matchId) return match;

        const next = { ...match };

        if ("participant1EntryId" in payload) {
          const participantId = typeof payload.participant1EntryId === "string" ? payload.participant1EntryId : "";
          const participant = participantId ? participantById.get(participantId) ?? null : null;
          next.participant1EntryId = participantId || null;
          next.player1Id = participant?.userId ?? null;
          next.player1 = participant ? { name: participant.user.name } : null;
        }

        if ("participant2EntryId" in payload) {
          const participantId = typeof payload.participant2EntryId === "string" ? payload.participant2EntryId : "";
          const participant = participantId ? participantById.get(participantId) ?? null : null;
          next.participant2EntryId = participantId || null;
          next.player2Id = participant?.userId ?? null;
          next.player2 = participant ? { name: participant.user.name } : null;
        }

        if ("status" in payload && Object.values(MatchStatus).includes(payload.status as MatchStatus)) {
          next.status = payload.status as MatchStatus;
        }

        if ("scheduledAt" in payload) {
          const value = typeof payload.scheduledAt === "string" ? payload.scheduledAt : "";
          const date = value ? new Date(value) : null;
          next.scheduledAt = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
        }

        if ("notes" in payload) {
          next.notes = typeof payload.notes === "string" && payload.notes ? payload.notes : null;
        }

        if ("player1Score" in payload) {
          const score = payload.player1Score;
          next.player1Score = typeof score === "number" && Number.isFinite(score) ? score : null;
        }

        if ("player2Score" in payload) {
          const score = payload.player2Score;
          next.player2Score = typeof score === "number" && Number.isFinite(score) ? score : null;
        }

        return next;
      }),
    );
  };

  const saveMatch = (matchId: string, payload: Record<string, unknown>) => {
    patchLocalMatch(matchId, payload);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/matches/${matchId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) router.refresh();
      } catch {
        router.refresh();
      }
    });
  };

  const reorderMatches = (round: number, sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    const withinRound = orderedMatches.filter((match) => match.round === round).sort((a, b) => a.matchNumber - b.matchNumber);
    const sourceIndex = withinRound.findIndex((match) => match.id === sourceId);
    const targetIndex = withinRound.findIndex((match) => match.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const moved = [...withinRound];
    const [item] = moved.splice(sourceIndex, 1);
    moved.splice(targetIndex, 0, item);

    const merged = orderedMatches.map((match) => {
      if (match.round !== round) return match;
      return {
        ...match,
        matchNumber: moved.findIndex((candidate) => candidate.id === match.id) + 1,
      };
    });

    setOrderedMatches(
      merged.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.matchNumber - b.matchNumber;
      }),
    );

    startTransition(async () => {
      await fetch(`/api/admin/tournaments/${tournamentId}/matches/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchIds: moved.map((match) => match.id),
        }),
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="РџРѕРёСЃРє РїРѕ РёРіСЂРѕРєСѓ, РіСЂСѓРїРїРµ, СЃС‚Р°РґРёРё РёР»Рё Р·Р°РјРµС‚РєРµ" className="pl-10" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white">
            <option value="all">Р’СЃРµ СЃС‚Р°С‚СѓСЃС‹</option>
            {Object.values(MatchStatus).map((status) => (
              <option key={status} value={status}>
                {matchStatusLabel[status] ?? status}
              </option>
            ))}
          </select>
          <select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white">
            <option value="all">Р’СЃРµ С‚СѓСЂС‹/СЂР°СѓРЅРґС‹</option>
            {rounds.map((round) => (
              <option key={round} value={round}>
                {roundSectionLabel(
                  orderedMatches.filter((match) => match.round === round),
                  round,
                )}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rounds.map((round) => {
        const roundMatches = visibleMatches.filter((match) => match.round === round).sort((a, b) => a.matchNumber - b.matchNumber);
        if (!roundMatches.length) return null;

        return (
          <div key={round} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{roundSectionLabel(roundMatches, round)}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{roundMatches.length} РјР°С‚С‡РµР№</div>
            </div>

            <div className="grid gap-4">
              {roundMatches.map((match) => {
                const selectedParticipantOne = match.participant1EntryId ? participantById.get(match.participant1EntryId) ?? null : null;
                const selectedParticipantTwo = match.participant2EntryId ? participantById.get(match.participant2EntryId) ?? null : null;
                return (
                  <div
                    key={match.id}
                    draggable
                    onDragStart={() => setDraggedMatchId(match.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!draggedMatchId) return;
                      reorderMatches(round, draggedMatchId, match.id);
                      setDraggedMatchId(null);
                    }}
                    className={cn(
                      "rounded-2xl border border-white/10 bg-[#101010]/95 p-3 transition hover:border-white/15 sm:p-4",
                      draggedMatchId === match.id && "border-primary/40 bg-primary/10",
                    )}
                  >
                    <div className="mb-3 flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold leading-tight text-white">
                          {roundLabel(match)} · Матч {match.matchNumber}
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-500">
                          {match.stage?.name ?? "Без стадии"}
                          {match.group?.name ? ` · ${match.group.name}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.86fr)] lg:items-start">
                      <div className="grid gap-3">
                        <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
                          <Badge className="h-9 justify-center px-3" variant={matchStatusVariant[match.status] ?? "neutral"}>
                            {matchStatusLabel[match.status] ?? match.status}
                          </Badge>
                          <select
                            value={match.status}
                            onChange={(event) => saveMatch(match.id, { status: event.target.value })}
                            className="h-9 rounded-lg border border-white/10 bg-[#0A0A0A] px-3 text-sm text-white outline-none transition focus:border-primary/60"
                          >
                            {Object.values(MatchStatus).map((status) => (
                              <option key={status} value={status}>
                                {matchStatusLabel[status] ?? status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-2">
                          <MatchSideSelect
                            label="Игрок 1"
                            value={match.participant1EntryId ?? ""}
                            placeholder="Выбрать игрока 1"
                            participants={participants}
                            selected={selectedParticipantOne}
                            onChange={(participantId) => {
                              const participant = participantId ? participantById.get(participantId) : null;
                              saveMatch(match.id, {
                                participant1EntryId: participantId,
                                player1Id: participant?.userId ?? null,
                              });
                            }}
                          />
                          <MatchSideSelect
                            label="Игрок 2"
                            value={match.participant2EntryId ?? ""}
                            placeholder="Выбрать игрока 2"
                            participants={participants}
                            selected={selectedParticipantTwo}
                            onChange={(participantId) => {
                              const participant = participantId ? participantById.get(participantId) : null;
                              saveMatch(match.id, {
                                participant2EntryId: participantId,
                                player2Id: participant?.userId ?? null,
                              });
                            }}
                          />
                        </div>

                        <div className="grid gap-2">
                          <FieldLabel>Дата и время</FieldLabel>
                          <div className="relative">
                            <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <Input
                              type="datetime-local"
                              defaultValue={toInputDate(match.scheduledAt)}
                              className="h-9 rounded-lg bg-black/30 pl-9 text-xs sm:text-sm"
                              onBlur={(event) => saveMatch(match.id, { scheduledAt: event.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                          <FieldLabel>Счет</FieldLabel>
                          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                            <Input
                              type="number"
                              defaultValue={match.player1Score ?? ""}
                              placeholder="0"
                              className="h-10 rounded-lg px-2 text-center text-lg font-semibold"
                              onBlur={(event) => saveMatch(match.id, { player1Score: scoreFromInput(event.target.value) })}
                            />
                            <span className="text-sm font-semibold text-zinc-500">:</span>
                            <Input
                              type="number"
                              defaultValue={match.player2Score ?? ""}
                              placeholder="0"
                              className="h-10 rounded-lg px-2 text-center text-lg font-semibold"
                              onBlur={(event) => saveMatch(match.id, { player2Score: scoreFromInput(event.target.value) })}
                            />
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <FieldLabel>Комментарий</FieldLabel>
                          <div className="relative">
                            <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <Input
                              type="text"
                              defaultValue={match.notes ?? ""}
                              placeholder="Комментарий к матчу"
                              className="h-9 rounded-lg bg-black/30 pl-9"
                              onBlur={(event) => saveMatch(match.id, { notes: event.target.value })}
                            />
                          </div>
                        </div>

                        <div className="truncate rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-zinc-400">
                          {participantName(selectedParticipantOne)} vs {participantName(selectedParticipantTwo)}
                        </div>

                        <div className="sticky bottom-2 z-20 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#080808]/95 p-2 backdrop-blur lg:static lg:flex lg:flex-wrap lg:border-0 lg:bg-transparent lg:p-0">
                          <Button
                            disabled={pending}
                            size="sm"
                            variant="secondary"
                            className="h-9 min-h-9 rounded-lg px-2 text-xs sm:px-3 sm:text-sm"
                            onClick={() => saveMatch(match.id, { status: MatchStatus.CONFIRMED })}
                          >
                            ОК
                          </Button>
                          <Button
                            disabled={pending}
                            size="sm"
                            variant="outline"
                            className="h-9 min-h-9 rounded-lg px-2 text-xs sm:px-3 sm:text-sm"
                            onClick={() => saveMatch(match.id, { status: MatchStatus.DISPUTED })}
                          >
                            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                            Спор
                          </Button>
                          <Button asChild size="sm" variant="outline" className="h-9 min-h-9 rounded-lg px-2 text-xs sm:px-3 sm:text-sm">
                            <Link href={`/admin/matches/${match.id}`}>
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Work
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!visibleMatches.length ? (
        <div className="rounded-[2rem] border border-dashed border-white/10 bg-black/10 p-5 text-sm text-zinc-500">РџРѕ С‚РµРєСѓС‰РёРј С„РёР»СЊС‚СЂР°Рј РјР°С‚С‡Рё РЅРµ РЅР°Р№РґРµРЅС‹.</div>
      ) : null}
    </div>
  );
}

