"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SubmissionState = {
  label: string;
  tone: "success" | "waiting" | "retry" | "danger";
};

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
  player1Name: string;
  player2Name: string;
  player1SubmissionState: SubmissionState;
  player2SubmissionState: SubmissionState;
  disputeHref: string;
  isDisputed: boolean;
};

function submissionToneClass(tone: SubmissionState["tone"]) {
  if (tone === "success") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (tone === "danger") return "border-red-400/20 bg-red-400/10 text-red-300";
  if (tone === "retry") return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  return "border-white/10 bg-white/5 text-zinc-300";
}

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
  player1Name,
  player2Name,
  player1SubmissionState,
  player2SubmissionState,
  disputeHref,
  isDisputed,
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
        setPlayer1Score("");
        setPlayer2Score("");
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

      <div className="grid gap-3 md:grid-cols-2">
        <div className={`rounded-2xl border p-4 text-sm ${submissionToneClass(player1SubmissionState.tone)}`}>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Игрок 1</div>
          <div className="mt-2 font-medium text-white">{player1Name}</div>
          <div className="mt-2">{player1SubmissionState.label}</div>
        </div>
        <div className={`rounded-2xl border p-4 text-sm ${submissionToneClass(player2SubmissionState.tone)}`}>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Игрок 2</div>
          <div className="mt-2 font-medium text-white">{player2Name}</div>
          <div className="mt-2">{player2SubmissionState.label}</div>
        </div>
      </div>

      {isDisputed ? (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="font-medium text-red-200">Спорный матч</div>
                <div className="mt-1 text-sm text-red-100/80">
                  Игроки трижды не совпали по счёту. Матч передан на проверку администрации, ручной ввод результата отключён.
                </div>
              </div>
              <Button asChild variant="outline" className="border-red-300/20 bg-red-500/10 text-red-100 hover:bg-red-500/20">
                <Link href={disputeHref}>Открыть спор</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-zinc-300">
              {waitingForOpponent ? <Clock3 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <div>{message}</div>
              {waitingForOpponent ? <div className="mt-2 text-zinc-500">Свой результат уже отправлен. Ожидается ответ второго игрока.</div> : null}
              {attemptsLeft > 0 && canSubmit ? <div className="mt-2 text-zinc-500">Осталось попыток на совпадение: {attemptsLeft}.</div> : null}
            </div>
          </div>
        </div>
      )}

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
          <Button onClick={onSubmit} disabled={isPending || player1Score === "" || player2Score === ""} className="sm:min-w-[180px]">
            {isPending ? "Сохранение..." : "Отправить счёт"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
