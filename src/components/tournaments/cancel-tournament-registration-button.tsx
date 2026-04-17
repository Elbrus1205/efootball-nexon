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
    <div className="flex w-full flex-col items-center space-y-2 sm:w-auto sm:items-start">
      <Button
        size="lg"
        variant="outline"
        onClick={cancelRegistration}
        disabled={isPending}
        className="w-full max-w-[320px] justify-center border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15 hover:text-white sm:w-auto sm:max-w-none"
      >
        {isPending ? "Отмена..." : "Отменить регистрацию"}
      </Button>
      {message ? <div className="max-w-[320px] text-center text-sm text-red-300 sm:max-w-none sm:text-left">{message}</div> : null}
    </div>
  );
}
