"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type MyMatchCardProps = {
  id: string;
  title: string;
  meta: string;
  statusLabel: string;
  statusVariant: "primary" | "accent" | "neutral" | "success" | "danger";
  scoreText: string;
  canSubmit: boolean;
  waitingForOpponent: boolean;
  attemptsLeft: number;
  helperText: string;
};

export function MyMatchCard({
  id,
  title,
  meta,
  statusLabel,
  statusVariant,
  scoreText,
  canSubmit,
  waitingForOpponent,
  attemptsLeft,
  helperText,
}: MyMatchCardProps) {
  const router = useRouter();
  const [player1Score, setPlayer1Score] = useState("");
  const [player2Score, setPlayer2Score] = useState("");
  const [message, setMessage] = useState(helperText);
  const [isPending, startTransition] = useTransition();

  const onSubmit = () => {
    startTransition(async () => {
      setMessage("Сохранение результата...");

      const response = await fetch(`/api/matches/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player1Score: Number(player1Score),
          player2Score: Number(player2Score),
        }),
      });

      const result = await response.json().catch(() => ({ error: "Не удалось обработать ответ сервера." }));
      setMessage(result.message ?? result.error ?? "Не удалось сохранить результат.");

      if (response.ok) {
        router.refresh();
      }
    });
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="font-medium text-white">{title}</div>
          <div className="mt-2 text-sm text-zinc-400">{meta}</div>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          <div className="text-sm font-medium text-zinc-300">{scoreText}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
        {message}
        {waitingForOpponent ? <div className="mt-2 text-zinc-500">Свой результат уже отправлен. Ожидается ответ второго игрока.</div> : null}
        {attemptsLeft > 0 && canSubmit ? <div className="mt-2 text-zinc-500">Осталось попыток на совпадение: {attemptsLeft}.</div> : null}
      </div>

      {canSubmit ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            type="number"
            min={0}
            max={99}
            placeholder="Голы игрока 1"
            value={player1Score}
            onChange={(event) => setPlayer1Score(event.target.value)}
          />
          <Input
            type="number"
            min={0}
            max={99}
            placeholder="Голы игрока 2"
            value={player2Score}
            onChange={(event) => setPlayer2Score(event.target.value)}
          />
          <Button
            onClick={onSubmit}
            disabled={isPending || player1Score === "" || player2Score === ""}
            className="sm:min-w-[180px]"
          >
            {isPending ? "Сохранение..." : "Отправить счёт"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
