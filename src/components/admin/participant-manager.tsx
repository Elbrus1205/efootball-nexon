"use client";

import { ParticipantStatus } from "@prisma/client";
import { ChevronDown, Plus, Search, Shuffle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { participantStatusLabel } from "@/lib/admin-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RosterMemberItem = {
  id: string;
  isCaptain: boolean;
  status: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    publicId?: string | null;
    telegramUsername?: string | null;
  };
};

type ParticipantItem = {
  id: string;
  status: ParticipantStatus;
  seed: number | null;
  clubSlug: string | null;
  clubName: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    publicId?: string | null;
    telegramUsername?: string | null;
  };
  group: {
    id: string;
    name: string;
  } | null;
  rosterMembers?: RosterMemberItem[];
};

type GroupItem = {
  id: string;
  name: string;
};

type UserOption = {
  id: string;
  name: string | null;
  email: string | null;
  publicId?: string | null;
  telegramUsername?: string | null;
  favoriteTeam?: string | null;
  clubs?: string[];
};

function userLabel(user: UserOption) {
  return user.name ?? user.email ?? user.id;
}

export function userMeta(user: UserOption) {
  return [user.name, user.email].filter(Boolean).join(" • ");
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function userSearchMeta(user: UserOption) {
  return [user.email, user.telegramUsername ? `@${user.telegramUsername}` : null, ...(user.clubs ?? [])].filter(Boolean).join(" • ");
}

function participantLabel(participant: ParticipantItem) {
  return participant.user.name ?? participant.user.email ?? participant.user.id;
}

function participantSearchText(participant: ParticipantItem) {
  return [
    participant.user.name,
    participant.user.email,
    participant.user.id,
    participant.user.publicId,
    participant.user.telegramUsername,
    participant.clubName,
    participant.clubSlug,
    participant.group?.name,
    participantStatusLabel[participant.status],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function ParticipantManager({
  tournamentId,
  participants,
  groups,
}: {
  tournamentId: string;
  participants: ParticipantItem[];
  groups: GroupItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [isUserSearchLoading, setIsUserSearchLoading] = useState(false);
  const [participantQuery, setParticipantQuery] = useState("");
  const [openParticipantId, setOpenParticipantId] = useState<string | null>(null);
  const [openReplacementTargetId, setOpenReplacementTargetId] = useState<string | null>(null);
  const [replacementByParticipant, setReplacementByParticipant] = useState<Record<string, string>>({});
  const [replacementSearchByParticipant, setReplacementSearchByParticipant] = useState<Record<string, string>>({});
  const [replacementOptionsByParticipant, setReplacementOptionsByParticipant] = useState<Record<string, UserOption[]>>({});
  const allLoadedUsers = useMemo(() => {
    const map = new Map<string, UserOption>();
    for (const user of userOptions) map.set(user.id, user);
    for (const options of Object.values(replacementOptionsByParticipant)) {
      for (const user of options) map.set(user.id, user);
    }
    return Array.from(map.values());
  }, [replacementOptionsByParticipant, userOptions]);
  const usersById = useMemo(() => new Map(allLoadedUsers.map((user) => [user.id, user])), [allLoadedUsers]);
  const normalizedParticipantQuery = normalizeSearch(participantQuery);
  const visibleParticipants = normalizedParticipantQuery
    ? participants.filter((participant) => participantSearchText(participant).includes(normalizedParticipantQuery))
    : [];

  const searchUsers = useCallback(async (query: string) => {
    const normalized = normalizeSearch(query);
    if (normalized.length < 2) return [];

    const response = await fetch(`/api/admin/tournaments/${tournamentId}/available-users?q=${encodeURIComponent(normalized)}`);
    if (!response.ok) return [];

    const payload = (await response.json().catch(() => ({ users: [] }))) as { users?: UserOption[] };
    return payload.users ?? [];
  }, [tournamentId]);

  useEffect(() => {
    const normalized = normalizeSearch(userSearch);
    setSelectedUserId("");

    if (normalized.length < 2) {
      setUserOptions([]);
      setIsUserSearchLoading(false);
      return;
    }

    let cancelled = false;
    setIsUserSearchLoading(true);
    const timer = window.setTimeout(() => {
      searchUsers(normalized)
        .then((items) => {
          if (!cancelled) setUserOptions(items);
        })
        .finally(() => {
          if (!cancelled) setIsUserSearchLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchUsers, userSearch]);

  useEffect(() => {
    if (!openReplacementTargetId) return;

    const normalized = normalizeSearch(replacementSearchByParticipant[openReplacementTargetId] ?? "");
    if (normalized.length < 2) {
      setReplacementOptionsByParticipant((current) => ({ ...current, [openReplacementTargetId]: [] }));
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchUsers(normalized).then((items) => {
        if (!cancelled) {
          setReplacementOptionsByParticipant((current) => ({ ...current, [openReplacementTargetId]: items }));
        }
      });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [openReplacementTargetId, replacementSearchByParticipant, searchUsers]);

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

      // Сбрасываем состояние поиска замены, чтобы следующую замену можно было сделать сразу
      // (иначе остаётся прежний выбранный игрок/запрос, и кандидаты не подгружаются заново).
      setOpenReplacementTargetId(null);
      setReplacementByParticipant({});
      setReplacementSearchByParticipant({});
      setReplacementOptionsByParticipant({});

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
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3 sm:p-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="min-w-0 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Найти игрока по нику, email, Telegram или клубу"
                className="h-10 rounded-lg pl-10 pr-10 text-sm"
              />
              {userSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setUserSearch("");
                    setSelectedUserId("");
                  }}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white"
                  aria-label="Очистить поиск"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {normalizeSearch(userSearch).length >= 2 ? (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-1">
                {isUserSearchLoading ? (
                  <div className="px-3 py-3 text-sm text-zinc-500">Ищу игрока...</div>
                ) : userOptions.length ? (
                  userOptions.map((user) => {
                    const isSelected = user.id === selectedUserId;

                    return (
                      <button
                        key={user.id}
                        type="button"
                        disabled={pending}
                        onClick={() => setSelectedUserId(user.id)}
                        className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${
                          isSelected ? "bg-primary/15 text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{userLabel(user)}</span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500">{userSearchMeta(user) || user.publicId || user.id}</span>
                        </span>
                        {isSelected ? <Badge variant="primary">Выбран</Badge> : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-3 text-sm text-zinc-500">Игрок не найден.</div>
                )}
              </div>
            ) : null}
          </div>
          <Button className="h-10 rounded-lg" disabled={pending || !selectedUserId} onClick={() => run({ action: "add", userId: selectedUserId })}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
          <Button className="h-10 rounded-lg" variant="secondary" disabled={pending || !groups.length} onClick={autoAssignGroups}>
            <Shuffle className="mr-2 h-4 w-4" />
            Автораспределение
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={participantQuery}
            placeholder="Найти участника по нику, email, клубу или группе"
            onChange={(event) => {
              setParticipantQuery(event.target.value);
              setOpenParticipantId(null);
            }}
            className="h-11 rounded-lg pl-10 pr-10 text-sm"
          />
          {participantQuery ? (
            <button
              type="button"
              onClick={() => {
                setParticipantQuery("");
                setOpenParticipantId(null);
              }}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          {normalizedParticipantQuery
            ? `Найдено: ${visibleParticipants.length}`
            : `В турнире ${participants.length} участников. Введите запрос, чтобы открыть нужного игрока.`}
        </div>
      </div>

      <div className="grid gap-3">
        {!normalizedParticipantQuery ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.025] px-4 py-6 text-center text-sm text-zinc-500">
            Список скрыт. Начните вводить ник, email, клуб или группу.
          </div>
        ) : visibleParticipants.length ? (
          visibleParticipants.map((participant) => {
            const replacementUserId = replacementByParticipant[participant.id] ?? "";
            const replacementQuery = replacementSearchByParticipant[participant.id] ?? "";
            const normalizedReplacementQuery = normalizeSearch(replacementQuery);
            const selectedReplacement = usersById.get(replacementUserId);
            const replacementMatches = normalizedReplacementQuery ? replacementOptionsByParticipant[participant.id] ?? [] : [];
            const canReplace = participant.status !== ParticipantStatus.REMOVED;
            const isHistoryEntry = participant.status === ParticipantStatus.REMOVED;
            const isOpen = openParticipantId === participant.id;
            const rosterMembers = participant.rosterMembers ?? [];
            const hasRosterReplacement = rosterMembers.length > 1;

            return (
              <div key={participant.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
                <button
                  type="button"
                  onClick={() => {
                    setOpenParticipantId(isOpen ? null : participant.id);
                    setOpenReplacementTargetId(null);
                  }}
                  className="flex w-full min-w-0 items-center justify-between gap-3 p-3 text-left transition hover:bg-white/[0.03] sm:p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium text-white sm:text-lg">{participantLabel(participant)}</div>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-500 sm:text-sm">
                      <Badge variant="neutral">{participantStatusLabel[participant.status]}</Badge>
                      <span className="truncate">{participant.group ? participant.group.name : "Без группы"}</span>
                      {participant.clubName ? <span className="truncate text-zinc-400">{participant.clubName}</span> : null}
                      {participant.seed ? <span>Seed {participant.seed}</span> : null}
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-500 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen ? (
                  <div className="space-y-3 border-t border-white/10 p-3 sm:p-4">
                    <div className="grid gap-2 sm:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto]">
                      <select
                        defaultValue={participant.group?.id ?? ""}
                        disabled={pending || isHistoryEntry}
                        className="h-10 min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-primary/50 disabled:opacity-50"
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
                        className="h-10 min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-primary/50 disabled:opacity-50"
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

                      <Button
                        variant="outline"
                        className="h-10 rounded-lg sm:w-auto"
                        disabled={pending || isHistoryEntry}
                        onClick={() => run({ action: "remove", registrationId: participant.id })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isHistoryEntry ? "История" : "Удалить"}
                      </Button>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                      {rosterMembers.length > 1 ? (
                        <div className="mb-3 space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Состав команды</div>
                          {rosterMembers.map((member) => {
                            const targetId = `member:${member.id}`;
                            const memberReplacementUserId = replacementByParticipant[targetId] ?? "";
                            const memberReplacementQuery = replacementSearchByParticipant[targetId] ?? "";
                            const normalizedMemberReplacementQuery = normalizeSearch(memberReplacementQuery);
                            const memberReplacementMatches = normalizedMemberReplacementQuery ? replacementOptionsByParticipant[targetId] ?? [] : [];
                            const selectedMemberReplacement = usersById.get(memberReplacementUserId);

                            return (
                              <div key={member.id} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                                <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)_auto] lg:items-start">
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <span className="truncate text-sm font-medium text-white">
                                        {member.user.name ?? member.user.email ?? member.user.id}
                                      </span>
                                      {member.isCaptain ? <Badge variant="primary">Капитан</Badge> : null}
                                    </div>
                                    {member.user.telegramUsername ? (
                                      <div className="mt-0.5 truncate text-xs text-zinc-500">@{member.user.telegramUsername}</div>
                                    ) : (
                                      <div className="mt-0.5 truncate text-xs text-zinc-500">{member.user.email ?? member.user.id}</div>
                                    )}
                                  </div>

                                  <div className="min-w-0 space-y-2">
                                    <div className="relative">
                                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                      <Input
                                        value={memberReplacementQuery}
                                        disabled={pending || !canReplace}
                                        placeholder="Новый игрок"
                                        onFocus={() => setOpenReplacementTargetId(targetId)}
                                        onChange={(event) => {
                                          setOpenReplacementTargetId(targetId);
                                          setReplacementSearchByParticipant((current) => ({
                                            ...current,
                                            [targetId]: event.target.value,
                                          }));
                                        }}
                                        className="h-9 rounded-lg pl-10 pr-10 text-sm"
                                      />
                                      {memberReplacementQuery ? (
                                        <button
                                          type="button"
                                          disabled={pending}
                                          onClick={() => {
                                            setReplacementSearchByParticipant((current) => ({
                                              ...current,
                                              [targetId]: "",
                                            }));
                                            setReplacementOptionsByParticipant((current) => ({ ...current, [targetId]: [] }));
                                          }}
                                          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                                          aria-label="Очистить поиск"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      ) : null}
                                    </div>

                                    {selectedMemberReplacement ? (
                                      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/[0.08] px-2.5 py-1.5">
                                        <div className="min-w-0">
                                          <div className="truncate text-xs font-medium text-white">{userLabel(selectedMemberReplacement)}</div>
                                          <div className="mt-0.5 truncate text-[11px] text-zinc-400">{userSearchMeta(selectedMemberReplacement) || "Игрок выбран"}</div>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={pending}
                                          onClick={() =>
                                            setReplacementByParticipant((current) => ({
                                              ...current,
                                              [targetId]: "",
                                            }))
                                          }
                                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                                          aria-label="Снять выбранного игрока"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : null}

                                    {normalizedMemberReplacementQuery ? (
                                      <div className="max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-1">
                                        {memberReplacementMatches.length ? (
                                          memberReplacementMatches.map((user) => {
                                            const isSelected = user.id === memberReplacementUserId;

                                            return (
                                              <button
                                                key={user.id}
                                                type="button"
                                                disabled={pending}
                                                onClick={() => {
                                                  setReplacementByParticipant((current) => ({
                                                    ...current,
                                                    [targetId]: user.id,
                                                  }));
                                                  setReplacementSearchByParticipant((current) => ({
                                                    ...current,
                                                    [targetId]: "",
                                                  }));
                                                  setOpenReplacementTargetId(null);
                                                }}
                                                className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${
                                                  isSelected ? "bg-primary/15 text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white"
                                                }`}
                                              >
                                                <span className="min-w-0">
                                                  <span className="block truncate text-sm font-medium">{userLabel(user)}</span>
                                                  <span className="mt-0.5 block truncate text-xs text-zinc-500">{userSearchMeta(user) || user.id}</span>
                                                </span>
                                                {isSelected ? <Badge variant="primary">Выбран</Badge> : null}
                                              </button>
                                            );
                                          })
                                        ) : (
                                          <div className="px-3 py-3 text-sm text-zinc-500">Игрок не найден.</div>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>

                                  <Button
                                    variant="secondary"
                                    className="h-9 shrink-0 rounded-lg px-3 text-xs"
                                    disabled={pending || !canReplace || !memberReplacementUserId}
                                    onClick={() =>
                                      run(
                                        { action: "replaceMember", memberId: member.id, replacementUserId: memberReplacementUserId },
                                        member.isCaptain ? "Капитан состава заменён." : "Игрок состава заменён.",
                                      )
                                    }
                                  >
                                    Заменить
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                          <div className="text-xs text-zinc-500">
                            Для коопа выберите нового игрока прямо напротив того участника, которого нужно заменить.
                          </div>
                        </div>
                      ) : null}
                      <div className={`grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start ${hasRosterReplacement ? "hidden" : ""}`}>
                        <div className="min-w-0 space-y-2">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <Input
                              value={replacementQuery}
                              disabled={pending || !canReplace}
                              placeholder="Найти игрока для замены"
                              onFocus={() => setOpenReplacementTargetId(participant.id)}
                              onChange={(event) => {
                                setOpenReplacementTargetId(participant.id);
                                setReplacementSearchByParticipant((current) => ({
                                  ...current,
                                  [participant.id]: event.target.value,
                                }));
                              }}
                              className="h-10 rounded-lg pl-10 pr-10 text-sm"
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
                                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                                aria-label="Очистить поиск"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>

                          {selectedReplacement ? (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/[0.08] px-3 py-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-white">{userLabel(selectedReplacement)}</div>
                                <div className="mt-0.5 truncate text-xs text-zinc-400">{userSearchMeta(selectedReplacement) || "Игрок выбран"}</div>
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

                          {normalizedReplacementQuery ? (
                            <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-1">
                              {replacementMatches.length ? (
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
                                      className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${
                                        isSelected ? "bg-primary/15 text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white"
                                      }`}
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">{userLabel(user)}</span>
                                        <span className="mt-0.5 block truncate text-xs text-zinc-500">{userSearchMeta(user) || user.id}</span>
                                      </span>
                                      {isSelected ? <Badge variant="primary">Выбран</Badge> : null}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-3 py-3 text-sm text-zinc-500">Игрок не найден.</div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <Button
                          variant="secondary"
                          className="h-10 rounded-lg px-5"
                          disabled={pending || !canReplace || !replacementUserId}
                          onClick={() =>
                            run(
                              {
                                action: "replace",
                                registrationId: participant.id,
                                replacementUserId,
                              },
                              "Игрок заменён. Таблица слота сохранена за новым участником.",
                            )
                          }
                        >
                          Заменить
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.025] px-4 py-6 text-center text-sm text-zinc-500">
            По этому запросу участник не найден.
          </div>
        )}
      </div>
    </div>
  );
}
