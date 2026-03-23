"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  sourceRef?: string | null;
};

type MatchItem = {
  id: string;
  round: number;
  matchNumber: number;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
};

type DragPayload =
  | {
      type: "pool";
      participantId: string;
    }
  | {
      type: "slot";
      participantId: string | null;
      round: number;
      matchNumber: number;
      slotNumber: number;
    };

function participantName(participant?: ParticipantOption | null) {
  return participant?.user.nickname ?? participant?.user.name ?? participant?.id ?? null;
}

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
  const [draggedItem, setDraggedItem] = useState<DragPayload | null>(null);

  const participantMap = useMemo(() => new Map(participants.map((participant) => [participant.id, participant])), [participants]);
  const slotMap = useMemo(() => new Map(slots.map((slot) => [`${slot.round}-${slot.matchNumber}-${slot.slotNumber}`, slot])), [slots]);
  const rounds = Array.from(new Set(matches.map((match) => match.round))).sort((a, b) => a - b);

  const saveSlot = (round: number, matchNumber: number, slotNumber: number, participantId: string | null) => {
    return fetch(`/api/admin/tournaments/${tournamentId}/bracket/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bracketId,
        round,
        matchNumber,
        slotNumber,
        participantId,
      }),
    });
  };

  const handleDrop = (round: number, matchNumber: number, slotNumber: number) => {
    if (!draggedItem) return;

    const targetKey = `${round}-${matchNumber}-${slotNumber}`;
    const targetSlot = slotMap.get(targetKey);
    const targetParticipantId = targetSlot?.participantId ?? null;

    startTransition(async () => {
      if (draggedItem.type === "pool") {
        await saveSlot(round, matchNumber, slotNumber, draggedItem.participantId);
      } else {
        await saveSlot(round, matchNumber, slotNumber, draggedItem.participantId);
        await saveSlot(draggedItem.round, draggedItem.matchNumber, draggedItem.slotNumber, targetParticipantId);
      }

      setDraggedItem(null);
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

  const usedParticipantIds = new Set(slots.map((slot) => slot.participantId).filter(Boolean));
  const availableParticipants = participants.filter((participant) => !usedParticipantIds.has(participant.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={pending} onClick={generateFromGroups}>
          <Sparkles className="mr-2 h-4 w-4" />
          Заполнить из групп
        </Button>
        <div className="text-sm text-zinc-500">Слоты поддерживают drag-and-drop из пула участников и между всеми парами сетки.</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">Пул участников</div>
          <div className="space-y-2">
            {availableParticipants.length ? (
              availableParticipants.map((participant) => (
                <button
                  key={participant.id}
                  draggable
                  onDragStart={() =>
                    setDraggedItem({
                      type: "pool",
                      participantId: participant.id,
                    })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white transition hover:border-primary/30"
                >
                  {participantName(participant)}
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-zinc-500">Все участники уже распределены по слотам.</div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-8 pb-3">
            {rounds.map((round, roundIndex) => {
              const isLastRound = roundIndex === rounds.length - 1;

              return (
                <div key={round} className="relative w-80 space-y-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">Раунд {round}</div>

                  {matches
                    .filter((match) => match.round === round)
                    .map((match) => (
                      <div key={match.id} className="relative rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                        {!isLastRound ? (
                          <>
                            <div className="pointer-events-none absolute -right-8 top-1/2 hidden h-px w-8 -translate-y-1/2 bg-gradient-to-r from-primary/70 to-transparent xl:block" />
                            <div className="pointer-events-none absolute right-[-2px] top-1/2 hidden h-px w-4 -translate-y-1/2 bg-primary/30 xl:block" />
                          </>
                        ) : null}

                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-sm text-zinc-400">Матч {match.matchNumber}</div>
                          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-600">Round {round}</div>
                        </div>

                        <div className="relative space-y-3">
                          <div className="pointer-events-none absolute left-6 top-[52px] hidden h-[58px] w-px bg-white/10 xl:block" />
                          <div className="pointer-events-none absolute left-6 top-[81px] hidden h-px w-7 bg-white/10 xl:block" />

                          {[1, 2].map((slotNumber) => {
                            const key = `${round}-${match.matchNumber}-${slotNumber}`;
                            const slot = slotMap.get(key);
                            const participant = slot?.participantId ? participantMap.get(slot.participantId) : null;

                            return (
                              <div
                                key={key}
                                draggable={Boolean(participant)}
                                onDragStart={() =>
                                  setDraggedItem({
                                    type: "slot",
                                    participantId: slot?.participantId ?? null,
                                    round,
                                    matchNumber: match.matchNumber,
                                    slotNumber,
                                  })
                                }
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  handleDrop(round, match.matchNumber, slotNumber);
                                }}
                                className={cn(
                                  "relative rounded-2xl border px-4 py-3 text-sm transition",
                                  participant ? "cursor-move border-primary/20 bg-primary/10 text-white shadow-[0_0_25px_rgba(59,130,246,0.12)]" : "border-dashed border-white/10 bg-black/20 text-zinc-500",
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div>{participant ? participantName(participant) : `Слот ${slotNumber}`}</div>
                                    {slot?.sourceRef ? <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{slot.sourceRef}</div> : null}
                                  </div>
                                  {participant ? (
                                    <button
                                      type="button"
                                      className="rounded-lg p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                                      onClick={() => {
                                        startTransition(async () => {
                                          await saveSlot(round, match.matchNumber, slotNumber, null);
                                          router.refresh();
                                        });
                                      }}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
