"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function CancelTournamentRegistrationButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const cancelRegistration = () => {
    const confirmed = window.confirm("Отменить регистрацию на турнир?");
    if (!confirmed) return;

    startTransition(async () => {
      setMessage("Отмена регистрации...");

      const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: "DELETE",
      });

      const result = await response.json().catch(() => ({ error: "Не удалось обработать ответ сервера." }));
      if (!response.ok) {
        setMessage(result.error ?? "Не удалось отменить регистрацию.");
        return;
      }

      setMessage("");
      router.refresh();
    });
  };

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={cancelRegistration}
        disabled={isPending}
        className="h-8 w-auto justify-center rounded-lg border-rose-400/25 bg-transparent px-3 text-xs font-semibold text-rose-200 hover:border-rose-300/45 hover:bg-rose-500/10 hover:text-rose-50"
      >
        {isPending ? "Отмена..." : "Отменить регистрацию"}
      </Button>
      {message ? <div className="text-sm text-red-300">{message}</div> : null}
    </div>
  );
}
