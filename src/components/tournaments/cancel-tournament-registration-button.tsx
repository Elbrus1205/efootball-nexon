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
    <div className="space-y-2">
      <Button
        size="lg"
        variant="outline"
        onClick={cancelRegistration}
        disabled={isPending}
        className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15 hover:text-white"
      >
        {isPending ? "Отмена..." : "Отменить регистрацию"}
      </Button>
      {message ? <div className="text-sm text-red-300">{message}</div> : null}
    </div>
  );
}
