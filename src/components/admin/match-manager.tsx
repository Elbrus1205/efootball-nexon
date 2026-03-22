"use client";

import { MatchStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

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
};

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MatchManager({
  matches,
  participants,
}: {
  matches: MatchItem[];
  participants: ParticipantOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <div key={match.id} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-white">Раунд {match.round} • Матч {match.matchNumber}</div>
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

            <input
              type="datetime-local"
              defaultValue={toInputDate(match.scheduledAt)}
              disabled={pending}
              onBlur={(event) => saveMatch(match.id, { scheduledAt: event.target.value })}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
            />

            <input
              type="text"
              defaultValue={match.notes ?? ""}
              placeholder="Комментарий к матчу"
              disabled={pending}
              onBlur={(event) => saveMatch(match.id, { notes: event.target.value })}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                defaultValue={match.player1Score ?? ""}
                placeholder="Счёт игрока 1"
                disabled={pending}
                onBlur={(event) => saveMatch(match.id, { player1Score: Number(event.target.value) || 0 })}
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
              />
              <input
                type="number"
                defaultValue={match.player2Score ?? ""}
                placeholder="Счёт игрока 2"
                disabled={pending}
                onBlur={(event) => saveMatch(match.id, { player2Score: Number(event.target.value) || 0 })}
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
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
  );
}
