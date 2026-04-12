"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
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
  meta?: string;
  statusLabel: string;
  statusVariant: "primary" | "accent" | "neutral" | "success" | "danger";
  scoreText: string;
  confirmedPlayer1Score?: number | null;
  confirmedPlayer2Score?: number | null;
  canSubmit: boolean;
  waitingForOpponent: boolean;
  attemptsLeft: number;
  helperText: string;
  player1Name: string;
  player2Name: string;
  player1Id?: string | null;
  player2Id?: string | null;
  player1ClubName?: string | null;
  player2ClubName?: string | null;
  player1ClubBadgePath?: string | null;
  player2ClubBadgePath?: string | null;
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
  confirmedPlayer1Score,
  confirmedPlayer2Score,
  canSubmit,
  waitingForOpponent,
  attemptsLeft,
  helperText,
  player1Name,
  player2Name,
  player1Id,
  player2Id,
  player1ClubName,
  player2ClubName,
  player1ClubBadgePath,
  player2ClubBadgePath,
  player1SubmissionState,
  player2SubmissionState,
  disputeHref,
  isDisputed,
}: MyMatchCardProps) {
  const router = useRouter();
  const [player1ScoreInput, setPlayer1ScoreInput] = useState("");
  const [player2ScoreInput, setPlayer2ScoreInput] = useState("");
  const [message, setMessage] = useState(helperText);
  const [isPending, startTransition] = useTransition();

  const hasConfirmedScore =
    confirmedPlayer1Score !== null &&
    confirmedPlayer1Score !== undefined &&
    confirmedPlayer2Score !== null &&
    confirmedPlayer2Score !== undefined;

  const onSubmit = () => {
    startTransition(async () => {
      setMessage("Сохранение результата...");

      const response = await fetch(`/api/matches/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player1Score: Number(player1ScoreInput),
          player2Score: Number(player2ScoreInput),
        }),
      });

      const result = await response.json().catch(() => ({
        error: "Не удалось обработать ответ сервера.",
      }));

      setMessage(result.message ?? result.error ?? "Не удалось сохранить результат.");

      if (response.ok) {
        setPlayer1ScoreInput("");
        setPlayer2ScoreInput("");
        router.refresh();
      }
    });
  };

  return (
    <Card className="space-y-3 p-4 sm:space-y-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="font-medium text-white">{title}</div>
          {meta ? (
            <div className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-400">
              <Clock3 className="h-4 w-4 shrink-0 text-zinc-500" />
              <span>{meta}</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-1.5 lg:items-end">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          {hasConfirmedScore ? null : <div className="text-sm font-medium text-zinc-300">{scoreText}</div>}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-3 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[190px_auto_190px] sm:justify-center sm:gap-2">
          <div className="min-w-0 sm:justify-self-end">
            <ClubPlayerLine
              playerId={player1Id}
              playerName={player1Name}
              clubName={player1ClubName}
              badgePath={player1ClubBadgePath}
              align="center"
              compact
              reverse
            />
            {player1SubmissionState.tone === "success" && statusLabel === "Подтверждён" ? null : (
              <div
                className={`mt-2 rounded-xl border px-2 py-1.5 text-center text-[11px] leading-4 sm:mt-3 sm:px-3 sm:py-2 sm:text-xs ${submissionToneClass(player1SubmissionState.tone)}`}
              >
                {player1SubmissionState.label}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-center self-center">
            <div className="flex min-w-[56px] items-center justify-center text-center text-xs font-semibold tracking-[0.24em] text-zinc-300 sm:min-w-[72px] sm:text-sm">
              {hasConfirmedScore ? `${confirmedPlayer1Score} - ${confirmedPlayer2Score}` : "VS"}
            </div>
          </div>

          <div className="min-w-0 sm:justify-self-start">
            <ClubPlayerLine
              playerId={player2Id}
              playerName={player2Name}
              clubName={player2ClubName}
              badgePath={player2ClubBadgePath}
              align="center"
              compact
            />
            {player2SubmissionState.tone === "success" && statusLabel === "Подтверждён" ? null : (
              <div
                className={`mt-2 rounded-xl border px-2 py-1.5 text-center text-[11px] leading-4 sm:mt-3 sm:px-3 sm:py-2 sm:text-xs ${submissionToneClass(player2SubmissionState.tone)}`}
              >
                {player2SubmissionState.label}
              </div>
            )}
          </div>
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
                  Игроки трижды не совпали по счёту. Матч передан на проверку администрации, ручной ввод результата
                  отключён.
                </div>
              </div>
              <Button asChild variant="outline" className="border-red-300/20 bg-red-500/10 text-red-100 hover:bg-red-500/20">
                <Link href={disputeHref}>Открыть спор</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-zinc-300 sm:h-10 sm:w-10">
              {waitingForOpponent ? <Clock3 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium leading-5 text-zinc-200">{message}</div>
              {waitingForOpponent ? (
                <div className="mt-1.5 text-xs leading-5 text-zinc-500 sm:text-sm">
                  Свой результат уже отправлен. Ожидается ответ соперника.
                </div>
              ) : null}
              {attemptsLeft > 0 && canSubmit ? (
                <div className="mt-1.5 inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-zinc-400 sm:text-xs">
                  Осталось попыток: {attemptsLeft}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {canSubmit ? (
        <div className="grid gap-2 sm:gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            type="number"
            min={0}
            max={99}
            placeholder="Голы первой команды"
            value={player1ScoreInput}
            onChange={(event) => setPlayer1ScoreInput(event.target.value)}
          />
          <Input
            type="number"
            min={0}
            max={99}
            placeholder="Голы второй команды"
            value={player2ScoreInput}
            onChange={(event) => setPlayer2ScoreInput(event.target.value)}
          />
          <Button
            onClick={onSubmit}
            disabled={isPending || player1ScoreInput === "" || player2ScoreInput === ""}
            className="sm:min-w-[180px]"
          >
            {isPending ? "Сохранение..." : "Отправить счёт"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
