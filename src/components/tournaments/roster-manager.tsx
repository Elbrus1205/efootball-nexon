"use client";

import { TeamInviteStatus, TournamentParticipantMode } from "@prisma/client";
import { Check, Send, X } from "lucide-react";
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
  currentMembership,
}: {
  tournamentId: string;
  participantMode: TournamentParticipantMode;
  rosterSize: number;
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

  const canInvite = currentMembership.isCaptain && currentMembership.status === TeamInviteStatus.ACCEPTED && activeMembers.length < rosterSize;

  if (currentMembership.status !== TeamInviteStatus.PENDING && !canInvite && !message) {
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

      {message ? <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{message}</div> : null}
    </Card>
  );
}
