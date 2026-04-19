"use client";

import { ParticipantStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { participantStatusLabel } from "@/lib/admin-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ParticipantItem = {
  id: string;
  status: ParticipantStatus;
  seed: number | null;
  user: {
    id: string;
    nickname: string | null;
    name: string | null;
    email: string | null;
  };
  group: {
    id: string;
    name: string;
  } | null;
};

type GroupItem = {
  id: string;
  name: string;
};

type UserOption = {
  id: string;
  nickname: string | null;
  name: string | null;
  email: string | null;
};

export function ParticipantManager({
  tournamentId,
  participants,
  groups,
  users,
}: {
  tournamentId: string;
  participants: ParticipantItem[];
  groups: GroupItem[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [replacementByParticipant, setReplacementByParticipant] = useState<Record<string, string>>({});

  const run = (body: Record<string, unknown>, successMessage?: string) => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({
        error: "Не удалось обработать ответ сервера.",
      }));

      if (!response.ok) {
        toast.error(payload?.error ?? "Не удалось выполнить действие.");
        return;
      }

      if (successMessage) {
        toast.success(successMessage);
      }

      router.refresh();
    });
  };

  const autoAssignGroups = () => {
    startTransition(async () => {
      await fetch(`/api/admin/tournaments/${tournamentId}/groups/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto" }),
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-white">
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.nickname ?? user.name ?? user.email ?? user.id}
              </option>
            ))}
          </select>
          <Button disabled={pending || !selectedUserId} onClick={() => run({ action: "add", userId: selectedUserId })}>
            Добавить участника
          </Button>
          <Button variant="secondary" disabled={pending || !groups.length} onClick={autoAssignGroups}>
            Автораспределение по группам
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {participants.map((participant) => {
          const replacementUserId = replacementByParticipant[participant.id] ?? "";
          const canReplace = participant.status !== ParticipantStatus.REMOVED;
          const isHistoryEntry = participant.status === ParticipantStatus.REMOVED;

          return (
            <div key={participant.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_minmax(280px,0.9fr)] xl:items-start">
                <div>
                  <div className="font-medium text-white">{participant.user.nickname ?? participant.user.name ?? participant.user.email}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                    <Badge variant="neutral">{participantStatusLabel[participant.status]}</Badge>
                    <span>{participant.group ? participant.group.name : "Без группы"}</span>
                    {participant.seed ? <span>Seed {participant.seed}</span> : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                    <select
                      defaultValue={participant.group?.id ?? ""}
                      disabled={pending || isHistoryEntry}
                      className="h-11 min-w-40 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
                      onChange={(event) =>
                        run({
                          action: "seed",
                          registrationId: participant.id,
                          groupId: event.target.value,
                          seed: participant.seed,
                        })
                      }
                    >
                      <option value="">Без группы</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>

                    <select
                      defaultValue={participant.status}
                      disabled={pending || isHistoryEntry}
                      className="h-11 min-w-40 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
                      onChange={(event) =>
                        run({
                          action: "status",
                          registrationId: participant.id,
                          status: event.target.value,
                        })
                      }
                    >
                      {Object.values(ParticipantStatus).map((status) => (
                        <option key={status} value={status}>
                          {participantStatusLabel[status]}
                        </option>
                      ))}
                    </select>

                    <Button variant="outline" disabled={pending || isHistoryEntry} onClick={() => run({ action: "remove", registrationId: participant.id })}>
                      {isHistoryEntry ? "В истории" : "Удалить"}
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <select
                        value={replacementUserId}
                        disabled={pending || !canReplace || !users.length}
                        className="h-11 min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
                        onChange={(event) =>
                          setReplacementByParticipant((current) => ({
                            ...current,
                            [participant.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Выбрать замену</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.nickname ?? user.name ?? user.email ?? user.id}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        disabled={pending || !canReplace || !replacementUserId}
                        onClick={() =>
                          run(
                            {
                              action: "replace",
                              registrationId: participant.id,
                              replacementUserId,
                            },
                            "Игрок заменён. Сыгранные матчи остались в истории старого игрока.",
                          )
                        }
                      >
                        Заменить
                      </Button>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-zinc-500">
                      Уже сыгранные матчи останутся старому игроку. Неначатые матчи этого слота перейдут новому участнику.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
