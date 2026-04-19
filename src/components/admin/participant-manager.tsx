"use client";

import { ParticipantStatus } from "@prisma/client";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { participantStatusLabel } from "@/lib/admin-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

function userLabel(user: UserOption) {
  return user.nickname ?? user.name ?? user.email ?? user.id;
}

function userMeta(user: UserOption) {
  return [user.nickname ? `@${user.nickname}` : null, user.name, user.email].filter(Boolean).join(" • ");
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

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
  const [replacementSearchByParticipant, setReplacementSearchByParticipant] = useState<Record<string, string>>({});
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

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
          const replacementQuery = replacementSearchByParticipant[participant.id] ?? "";
          const normalizedReplacementQuery = normalizeSearch(replacementQuery);
          const selectedReplacement = usersById.get(replacementUserId);
          const replacementMatches = normalizedReplacementQuery
            ? users
                .filter((user) =>
                  [user.nickname, user.name, user.email, user.id]
                    .filter(Boolean)
                    .some((value) => value?.toLowerCase().includes(normalizedReplacementQuery)),
                )
                .slice(0, 8)
            : [];
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
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0 space-y-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <Input
                            value={replacementQuery}
                            disabled={pending || !canReplace || !users.length}
                            placeholder="Найти игрока по никнейму"
                            onChange={(event) =>
                              setReplacementSearchByParticipant((current) => ({
                                ...current,
                                [participant.id]: event.target.value,
                              }))
                            }
                            className="h-11 rounded-xl pl-10 pr-10"
                          />
                          {replacementQuery ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                setReplacementSearchByParticipant((current) => ({
                                  ...current,
                                  [participant.id]: "",
                                }))
                              }
                              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                              aria-label="Очистить поиск"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>

                        {selectedReplacement ? (
                          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.08] px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{userLabel(selectedReplacement)}</div>
                              <div className="mt-0.5 truncate text-xs text-zinc-400">{userMeta(selectedReplacement) || "Игрок выбран"}</div>
                            </div>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                setReplacementByParticipant((current) => ({
                                  ...current,
                                  [participant.id]: "",
                                }))
                              }
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                              aria-label="Снять выбранного игрока"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}

                        <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1">
                          {!users.length ? (
                            <div className="px-3 py-3 text-sm text-zinc-500">Нет доступных игроков для замены.</div>
                          ) : normalizedReplacementQuery ? (
                            replacementMatches.length ? (
                              replacementMatches.map((user) => {
                                const isSelected = user.id === replacementUserId;

                                return (
                                  <button
                                    key={user.id}
                                    type="button"
                                    disabled={pending}
                                    onClick={() => {
                                      setReplacementByParticipant((current) => ({
                                        ...current,
                                        [participant.id]: user.id,
                                      }));
                                      setReplacementSearchByParticipant((current) => ({
                                        ...current,
                                        [participant.id]: "",
                                      }));
                                    }}
                                    className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                                      isSelected ? "bg-primary/15 text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white"
                                    }`}
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-medium">{userLabel(user)}</span>
                                      <span className="mt-0.5 block truncate text-xs text-zinc-500">{userMeta(user) || user.id}</span>
                                    </span>
                                    {isSelected ? <Badge variant="primary">Выбран</Badge> : null}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-3 py-3 text-sm text-zinc-500">По такому никнейму игрок не найден.</div>
                            )
                          ) : (
                            <div className="px-3 py-3 text-sm text-zinc-500">Начните вводить никнейм, имя или email игрока.</div>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        className="h-11 rounded-xl px-5"
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
