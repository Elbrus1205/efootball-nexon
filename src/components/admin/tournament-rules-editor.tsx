"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function TournamentRulesEditor({ tournamentId, initialRules }: { tournamentId: string; initialRules: string }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const saveRules = () => {
    startTransition(async () => {
      setMessage("Сохранение...");

      const response = await fetch(`/api/admin/tournaments/${tournamentId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });

      const result = await response.json().catch(() => ({
        error: "Не удалось обработать ответ сервера.",
      }));

      if (!response.ok) {
        setMessage(result.error ?? "Не удалось сохранить регламент.");
        return;
      }

      setMessage("Регламент сохранен.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={rules}
        onChange={(event) => setRules(event.target.value)}
        placeholder="Напишите регламент турнира: правила матчей, подтверждение результата, спорные ситуации."
        className="min-h-[260px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-400">{message}</div>
        <Button onClick={saveRules} disabled={isPending || rules.trim().length < 20}>
          {isPending ? "Сохранение..." : "Сохранить регламент"}
        </Button>
      </div>
    </div>
  );
}
