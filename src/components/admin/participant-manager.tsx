"use client";

import { ParticipantStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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

  const run = (body: Record<string, unknown>) => {
    startTransition(async () => {
      await fetch(`/api/admin/tournaments/${tournamentId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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
        {participants.map((participant) => (
          <div key={participant.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="font-medium text-white">{participant.user.nickname ?? participant.user.name ?? participant.user.email}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                  <Badge variant="neutral">{participantStatusLabel[participant.status]}</Badge>
                  <span>{participant.group ? participant.group.name : "Без группы"}</span>
                  {participant.seed ? <span>Seed {participant.seed}</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  defaultValue={participant.group?.id ?? ""}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
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
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
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

                <Button variant="outline" disabled={pending} onClick={() => run({ action: "remove", registrationId: participant.id })}>
                  Удалить
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
