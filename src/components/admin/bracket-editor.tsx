"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

type ParticipantOption = {
  id: string;
  user: {
    nickname: string | null;
    name: string | null;
  };
};

type SlotItem = {
  id: string;
  round: number;
  matchNumber: number;
  slotNumber: number;
  participantId: string | null;
};

type MatchItem = {
  id: string;
  round: number;
  matchNumber: number;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
};

export function BracketEditor({
  tournamentId,
  bracketId,
  participants,
  slots,
  matches,
}: {
  tournamentId: string;
  bracketId: string;
  participants: ParticipantOption[];
  slots: SlotItem[];
  matches: MatchItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const slotMap = new Map(slots.map((slot) => [`${slot.round}-${slot.matchNumber}-${slot.slotNumber}`, slot]));
  const rounds = Array.from(new Set(matches.map((match) => match.round))).sort((a, b) => a - b);

  const saveSlot = (round: number, matchNumber: number, slotNumber: number, participantId: string) => {
    startTransition(async () => {
      await fetch(`/api/admin/tournaments/${tournamentId}/bracket/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bracketId,
          round,
          matchNumber,
          slotNumber,
          participantId: participantId || null,
        }),
      });
      router.refresh();
    });
  };

  const generateFromGroups = () => {
    startTransition(async () => {
      await fetch(`/api/admin/tournaments/${tournamentId}/playoff/from-groups`, {
        method: "POST",
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={pending} onClick={generateFromGroups}>
          Заполнить из групп
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-4 pb-3">
          {rounds.map((round) => (
            <div key={round} className="w-72 space-y-3">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">Раунд {round}</div>
              {matches
                .filter((match) => match.round === round)
                .map((match) => (
                  <div key={match.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 text-sm text-zinc-400">Матч {match.matchNumber}</div>
                    {[1, 2].map((slotNumber) => {
                      const key = `${round}-${match.matchNumber}-${slotNumber}`;
                      const slot = slotMap.get(key);
                      return (
                        <select
                          key={key}
                          defaultValue={slot?.participantId ?? ""}
                          disabled={pending}
                          onChange={(event) => saveSlot(round, match.matchNumber, slotNumber, event.target.value)}
                          className="mb-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white"
                        >
                          <option value="">Слот {slotNumber}</option>
                          {participants.map((participant) => (
                            <option key={participant.id} value={participant.id}>
                              {participant.user.nickname ?? participant.user.name ?? participant.id}
                            </option>
                          ))}
                        </select>
                      );
                    })}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
