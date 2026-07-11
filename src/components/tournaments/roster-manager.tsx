"use client";

import { TeamInviteStatus, TournamentParticipantMode, TournamentStatus } from "@prisma/client";
import { Check, Send, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RosterMember = {
  id: string;
  status: TeamInviteStatus;
  isCaptain: boolean;
  user: { id: string; name: string | null; email: string | null; telegramId?: string | null; telegramUsername?: string | null };
};

export function RosterManager({
  tournamentId,
  participantMode,
  rosterSize,
  tournamentStatus,
  currentMembership,
}: {
  tournamentId: string;
  participantMode: TournamentParticipantMode;
  rosterSize: number;
  tournamentStatus: TournamentStatus;
  currentMembership:
    | {
        id: string;
        status: TeamInviteStatus;
        isCaptain: boolean;
        registration: {
          id: string;
          teamName: string | null;
          clubName: string | null;
          rosterMembers: RosterMember[];
        };
      }
    | null;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const activeMembers = useMemo(
    () =>
      (currentMembership?.registration.rosterMembers ?? []).filter(
        (member) => member.status === TeamInviteStatus.PENDING || member.status === TeamInviteStatus.ACCEPTED,
      ),
    [currentMembership],
  );

  if (participantMode === TournamentParticipantMode.SINGLE || !currentMembership) {
    return null;
  }

  const canManageRoster =
    currentMembership.isCaptain &&
    currentMembership.status === TeamInviteStatus.ACCEPTED &&
    tournamentStatus === TournamentStatus.REGISTRATION_OPEN;
  const canInvite = canManageRoster && activeMembers.length < rosterSize;

  if (currentMembership.status !== TeamInviteStatus.PENDING && !canManageRoster && !message) {
    return null;
  }

  const respond = (action: "accept" | "decline") => {
    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/tournaments/${tournamentId}/roster/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({ error: "Не удалось обработать приглашение." }));
      if (!response.ok) {
        setMessage(result.error ?? "Не удалось обработать приглашение.");
        return;
      }
      router.refresh();
    });
  };

  const invite = () => {
    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/tournaments/${tournamentId}/roster/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const result = await response.json().catch(() => ({ error: "Не удалось отправить приглашение." }));
      if (!response.ok) {
        setMessage(result.error ?? "Не удалось отправить приглашение.");
        return;
      }
      setNickname("");
      router.refresh();
    });
  };

  const removeMember = (memberId: string, status: TeamInviteStatus) => {
    const confirmed = window.confirm(status === TeamInviteStatus.PENDING ? "Отменить приглашение игрока?" : "Удалить игрока из состава?");
    if (!confirmed) return;

    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/tournaments/${tournamentId}/roster/invite`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const result = await response.json().catch(() => ({ error: "Не удалось изменить состав." }));
      if (!response.ok) {
        setMessage(result.error ?? "Не удалось изменить состав.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Управление составом</div>
          <p className="mt-1 text-sm text-zinc-400">
            {activeMembers.length}/{rosterSize} игроков
          </p>
        </div>

        {currentMembership.status === TeamInviteStatus.PENDING ? (
          <div className="flex gap-2">
            <Button size="sm" className="gap-2" disabled={isPending} onClick={() => respond("accept")}>
              <Check className="h-4 w-4" />
              Принять
            </Button>
            <Button size="sm" variant="outline" className="gap-2" disabled={isPending} onClick={() => respond("decline")}>
              <X className="h-4 w-4" />
              Отклонить
            </Button>
          </div>
        ) : null}
      </div>

      {canInvite ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/60"
            placeholder="Ник, email или Telegram"
          />
          <Button className="gap-2" disabled={isPending || nickname.trim().length < 2} onClick={invite}>
            <Send className="h-4 w-4" />
            Пригласить
          </Button>
        </div>
      ) : null}

      {canManageRoster ? (
        <div className="grid gap-2">
          {activeMembers.map((member) => {
            const memberName = member.user.name?.trim() || member.user.email || "Игрок";
            const canRemoveMember = !member.isCaptain;

            return (
              <div key={member.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{memberName}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {member.isCaptain ? "Капитан" : member.status === TeamInviteStatus.ACCEPTED ? "В составе" : "Приглашение отправлено"}
                  </div>
                </div>

                {canRemoveMember ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    className="min-h-11 shrink-0 gap-1.5 rounded-lg border-rose-400/25 px-3 text-xs text-rose-100 hover:border-rose-300/45 hover:bg-rose-500/10"
                    onClick={() => removeMember(member.id, member.status)}
                  >
                    {member.status === TeamInviteStatus.PENDING ? <X className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                    {member.status === TeamInviteStatus.PENDING ? "Отменить" : "Удалить"}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {message ? <div aria-live="polite" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{message}</div> : null}
    </Card>
  );
}
