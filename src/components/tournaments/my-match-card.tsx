"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SubmissionState = {
  label: string;
  tone: "success" | "waiting" | "retry" | "danger";
};

type MyMatchCardProps = {
  id: string;
  meta?: string;
  isConfirmed: boolean;
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
  return "border-white/10 bg-white/5 text-zinc-400";
}

export function MyMatchCard({
  id,
  meta,
  isConfirmed,
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
      const result = await response.json().catch(() => ({ error: "Не удалось обработать ответ сервера." }));
      setMessage(result.message ?? result.error ?? "Не удалось сохранить результат.");
      if (response.ok) {
        setPlayer1ScoreInput("");
        setPlayer2ScoreInput("");
        router.refresh();
      }
    });
  };

  return (
    <Card
      className={cn(
        "overflow-hidden p-0 transition",
        isConfirmed && "border-emerald-400/40 shadow-[0_0_32px_rgba(52,211,153,0.12)]",
        isDisputed && "border-red-400/30",
      )}
    >
      {/* Header strip */}
      {meta ? (
        <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-xs text-zinc-500">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span>{meta}</span>
        </div>
      ) : null}

      <div className="p-4 sm:p-5">
        {/* Match grid */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-4">
          {/* Player 1 */}
          <div className="min-w-0">
            <ClubPlayerLine
              playerId={player1Id}
              playerName={player1Name}
              clubName={player1ClubName}
              badgePath={player1ClubBadgePath}
              align="center"
              compact
              reverse
            />
            {!(player1SubmissionState.tone === "success" && isConfirmed) ? (
              <div className={cn("mt-2 rounded-lg border px-2 py-1 text-center text-[10px] leading-[1.4]", submissionToneClass(player1SubmissionState.tone))}>
                {player1SubmissionState.label}
              </div>
            ) : null}
          </div>

          {/* Score */}
          <div className="flex flex-col items-center justify-start gap-1 pt-0.5 self-start">
            {hasConfirmedScore ? (
              <div className="flex items-center gap-1">
                <span className="min-w-[1.75rem] rounded-lg bg-white/[0.06] px-2 py-1 text-center text-base font-bold text-white sm:text-lg">
                  {confirmedPlayer1Score}
                </span>
                <span className="text-xs font-semibold text-zinc-500">:</span>
                <span className="min-w-[1.75rem] rounded-lg bg-white/[0.06] px-2 py-1 text-center text-base font-bold text-white sm:text-lg">
                  {confirmedPlayer2Score}
                </span>
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold tracking-[0.2em] text-zinc-400">
                VS
              </div>
            )}
            {isConfirmed ? (
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-400">Подтверждён</div>
            ) : null}
          </div>

          {/* Player 2 */}
          <div className="min-w-0">
            <ClubPlayerLine
              playerId={player2Id}
              playerName={player2Name}
              clubName={player2ClubName}
              badgePath={player2ClubBadgePath}
              align="center"
              compact
            />
            {!(player2SubmissionState.tone === "success" && isConfirmed) ? (
              <div className={cn("mt-2 rounded-lg border px-2 py-1 text-center text-[10px] leading-[1.4]", submissionToneClass(player2SubmissionState.tone))}>
                {player2SubmissionState.label}
              </div>
            ) : null}
          </div>
        </div>

        {/* Score input */}
        {canSubmit ? (
          <div className="mt-4 space-y-3">
            <div className="space-y-2.5">
              {/* Score inputs centered */}
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-6 py-3">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    placeholder="0"
                    value={player1ScoreInput}
                    onChange={(e) => setPlayer1ScoreInput(e.target.value)}
                    className="w-12 bg-transparent text-center text-2xl font-bold text-white outline-none placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-xl font-semibold text-zinc-500">:</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    placeholder="0"
                    value={player2ScoreInput}
                    onChange={(e) => setPlayer2ScoreInput(e.target.value)}
                    className="w-12 bg-transparent text-center text-2xl font-bold text-white outline-none placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>
              {/* Submit button full width */}
              <button
                onClick={onSubmit}
                disabled={isPending || player1ScoreInput === "" || player2ScoreInput === ""}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_18px_rgba(59,130,246,0.25)] transition-all hover:bg-primary/90 hover:shadow-[0_4px_24px_rgba(59,130,246,0.35)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {isPending ? "Отправка..." : "Отправить результат"}
              </button>
            </div>

            {/* Helper info */}
            <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-relaxed text-zinc-400">{message}</p>
                {attemptsLeft > 0 && !waitingForOpponent ? (
                  <div className="mt-1.5 inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[10px] font-medium text-zinc-500">
                    Осталось попыток: {attemptsLeft}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : waitingForOpponent ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <div>
              <p className="text-xs font-medium text-zinc-300">Ожидание соперника</p>
              <p className="mt-0.5 text-xs text-zinc-500">Ваш результат отправлен. Ждём подтверждения от оппонента.</p>
            </div>
          </div>
        ) : isDisputed ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-300">Спорный матч</p>
              <p className="mt-0.5 text-xs text-red-200/70">
                Игроки трижды не совпали по счёту. Результат выставляет администрация.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2.5 border-red-300/20 bg-red-500/10 text-red-100 hover:bg-red-500/20">
                <Link href={disputeHref}>Открыть спор</Link>
              </Button>
            </div>
          </div>
        ) : !isConfirmed && helperText ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <p className="text-xs leading-relaxed text-zinc-400">{helperText}</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
