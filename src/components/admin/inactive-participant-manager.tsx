"use client";

import { ParticipantStatus } from "@prisma/client";
import { Search, UserCheck, UserRoundX } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ParticipantItem = {
  id: string;
  status: ParticipantStatus;
  isActive: boolean;
  inactiveFromRound: number | null;
  inactiveSince: Date | string | null;
  seed: number | null;
  clubSlug: string | null;
  clubName: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    publicId: string | null;
    telegramUsername: string | null;
  };
  group: { name: string } | null;
};

function playerName(participant: ParticipantItem) {
  return participant.user.name?.trim() || participant.user.email?.split("@")[0] || participant.user.publicId || "Игрок";
}

function telegramName(participant: ParticipantItem) {
  return participant.user.telegramUsername ? `@${participant.user.telegramUsername.replace(/^@/, "")}` : null;
}

function searchText(participant: ParticipantItem) {
  return [
    playerName(participant),
    participant.user.email,
    participant.user.publicId,
    participant.user.telegramUsername,
    participant.clubName,
    participant.clubSlug,
    participant.group?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function InactiveParticipantManager({
  tournamentId,
  tournamentTitle,
  participants,
}: {
  tournamentId: string;
  tournamentTitle: string;
  participants: ParticipantItem[];
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return participants.filter((participant) => !normalized || searchText(participant).includes(normalized));
  }, [participants, query]);
  const active = filtered.filter((participant) => participant.isActive);
  const inactive = filtered.filter((participant) => !participant.isActive);

  const changeStatus = (participant: ParticipantItem, nextActive: boolean) => {
    const message = nextActive
      ? `Сделать игрока «${playerName(participant)}» активным? Он снова сможет отправлять результаты.`
      : `Сделать игрока «${playerName(participant)}» неактивным с эффективного тура? Система сама учтёт дедлайн: минимум 12 часов — текущий тур, иначе следующий. Матчи с этого тура будут исключены из статистики.`;
    if (!window.confirm(`${message}\n\nТурнир: ${tournamentTitle}`)) return;

    startTransition(async () => {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextActive ? "setActive" : "setInactive",
          registrationId: participant.id,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Не удалось изменить статус участника.");
        return;
      }
      toast.success(nextActive ? "Игрок снова активен." : "Игрок отмечен неактивным с рассчитанного эффективного тура.");
      window.location.reload();
    });
  };

  const list = (title: string, items: ParticipantItem[], isInactive: boolean) => (
    <Card className="overflow-hidden rounded-lg border-white/10 bg-white/[0.035]">
      <CardHeader className="border-b border-white/8 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {isInactive ? <UserRoundX className="h-4 w-4 text-amber-200" /> : <UserCheck className="h-4 w-4 text-emerald-300" />}
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{items.length} участник{items.length === 1 ? "" : items.length < 5 ? "а" : "ов"}</CardDescription>
          </div>
          <Badge variant={isInactive ? "accent" : "success"}>{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-3 sm:p-4">
        {items.length ? items.map((participant) => (
          <div key={participant.id} className="flex flex-col gap-3 rounded-lg border border-white/8 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-zinc-100">{playerName(participant)}</span>
                {participant.clubName ? <span className="truncate text-sm text-amber-100/80">{participant.clubName}</span> : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                {telegramName(participant) ? <span>{telegramName(participant)}</span> : null}
                {participant.user.email ? <span>{participant.user.email}</span> : null}
                {participant.group?.name ? <span>{participant.group.name}</span> : null}
                {isInactive && participant.inactiveFromRound ? <span className="text-amber-200/80">с {participant.inactiveFromRound}-го тура</span> : null}
              </div>
            </div>
            <Button type="button" variant={isInactive ? "outline" : "secondary"} size="sm" disabled={pending} onClick={() => changeStatus(participant, isInactive)}>
              {isInactive ? "Сделать активным" : "Сделать неактивным"}
            </Button>
          </div>
        )) : <p className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">По этому фильтру игроков нет.</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border-primary/15 bg-white/[0.045]">
        <CardContent className="p-4 sm:p-5">
          <label className="relative block">
            <span className="sr-only">Поиск участника</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Ник сайта, Telegram, email или клуб" />
          </label>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {list("Активные участники", active, false)}
        {list("Неактивные участники", inactive, true)}
      </div>
    </div>
  );
}
