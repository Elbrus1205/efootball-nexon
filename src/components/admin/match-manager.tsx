"use client";

import { MatchStatus } from "@prisma/client";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ParticipantOption = {
  id: string;
  userId: string;
  user: {
    nickname: string | null;
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
  player1: { nickname: string | null; name: string | null } | null;
  player2: { nickname: string | null; name: string | null } | null;
  stage?: { name: string | null } | null;
  group?: { name: string } | null;
};

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const statusVariant: Partial<Record<MatchStatus, "primary" | "accent" | "neutral" | "success" | "danger">> = {
  SCHEDULED: "primary",
  LIVE: "accent",
  DISPUTED: "danger",
  CONFIRMED: "success",
  FINISHED: "success",
  REJECTED: "danger",
};

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

  const rounds = useMemo(() => Array.from(new Set(orderedMatches.map((match) => match.round))).sort((a, b) => a - b), [orderedMatches]);

  const saveMatch = (matchId: string, payload: Record<string, unknown>) => {
    startTransition(async () => {
      await fetch(`/api/admin/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.refresh();
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
      const next = moved.find((candidate) => candidate.id === match.id);
      return next ? { ...match, matchNumber: moved.findIndex((candidate) => candidate.id === match.id) + 1 } : match;
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
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-400">
        Карточки матчей можно перетаскивать внутри раунда, чтобы быстро менять порядок board и нумерацию пар.
      </div>

      {rounds.map((round) => {
        const roundMatches = orderedMatches.filter((match) => match.round === round).sort((a, b) => a.matchNumber - b.matchNumber);

        return (
          <div key={round} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Раунд {round}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{roundMatches.length} матчей</div>
            </div>

            <div className="grid gap-4">
              {roundMatches.map((match) => (
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
                    "rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 transition",
                    draggedMatchId === match.id && "border-primary/40 bg-primary/10",
                  )}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-400">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-white">Раунд {match.round} • Матч {match.matchNumber}</div>
                        <div className="mt-1 text-sm text-zinc-500">
                          {match.stage?.name ?? "Без стадии"} {match.group?.name ? `• ${match.group.name}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusVariant[match.status] ?? "neutral"}>{match.status}</Badge>
                      <select
                        defaultValue={match.status}
                        disabled={pending}
                        onChange={(event) => saveMatch(match.id, { status: event.target.value })}
                        className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
                      >
                        {Object.values(MatchStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    <select
                      defaultValue={match.participant1EntryId ?? ""}
                      disabled={pending}
                      onChange={(event) => {
                        const participant = participants.find((item) => item.id === event.target.value);
                        saveMatch(match.id, {
                          participant1EntryId: event.target.value,
                          player1Id: participant?.userId ?? null,
                        });
                      }}
                      className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
                    >
                      <option value="">Игрок 1</option>
                      {participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.user.nickname ?? participant.user.name ?? participant.id}
                        </option>
                      ))}
                    </select>

                    <select
                      defaultValue={match.participant2EntryId ?? ""}
                      disabled={pending}
                      onChange={(event) => {
                        const participant = participants.find((item) => item.id === event.target.value);
                        saveMatch(match.id, {
                          participant2EntryId: event.target.value,
                          player2Id: participant?.userId ?? null,
                        });
                      }}
                      className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
                    >
                      <option value="">Игрок 2</option>
                      {participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.user.nickname ?? participant.user.name ?? participant.id}
                        </option>
                      ))}
                    </select>

                    <Input
                      type="datetime-local"
                      defaultValue={toInputDate(match.scheduledAt)}
                      disabled={pending}
                      onBlur={(event) => saveMatch(match.id, { scheduledAt: event.target.value })}
                    />

                    <Input
                      type="text"
                      defaultValue={match.notes ?? ""}
                      placeholder="Комментарий к матчу"
                      disabled={pending}
                      onBlur={(event) => saveMatch(match.id, { notes: event.target.value })}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        type="number"
                        defaultValue={match.player1Score ?? ""}
                        placeholder="Счёт игрока 1"
                        disabled={pending}
                        onBlur={(event) => saveMatch(match.id, { player1Score: Number(event.target.value) || 0 })}
                      />
                      <Input
                        type="number"
                        defaultValue={match.player2Score ?? ""}
                        placeholder="Счёт игрока 2"
                        disabled={pending}
                        onBlur={(event) => saveMatch(match.id, { player2Score: Number(event.target.value) || 0 })}
                      />
                    </div>

                    <div className="flex items-center text-sm text-zinc-400">
                      {(match.player1?.nickname ?? match.player1?.name ?? "Игрок 1")} vs {(match.player2?.nickname ?? match.player2?.name ?? "Игрок 2")}
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button disabled={pending} variant="secondary" onClick={() => saveMatch(match.id, { status: MatchStatus.CONFIRMED })}>
                      Подтвердить матч
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
