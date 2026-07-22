"use client";

import Link from "next/link";
import { AlertTriangle, Check, Clock3 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SubmissionState = {
  label: string;
  tone: "success" | "pending" | "waiting" | "retry" | "danger";
};

type SubmittedScore = {
  player1Score: number;
  player2Score: number;
  player1PenaltyScore?: number | null;
  player2PenaltyScore?: number | null;
};

type MyMatchCardProps = {
  id: string;
  meta?: string;
  isConfirmed: boolean;
  confirmedPlayer1Score?: number | null;
  confirmedPlayer2Score?: number | null;
  confirmedPlayer1PenaltyScore?: number | null;
  confirmedPlayer2PenaltyScore?: number | null;
  canSubmit: boolean;
  requiresPenaltyOnDraw: boolean;
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
  player1SubmittedScore?: SubmittedScore;
  player2SubmittedScore?: SubmittedScore;
  disputeHref: string;
  isDisputed: boolean;
};

function submissionToneClass(tone: SubmissionState["tone"]) {
  if (tone === "success") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (tone === "pending") return "border-sky-400/20 bg-sky-400/10 text-sky-300";
  if (tone === "danger") return "border-red-400/20 bg-red-400/10 text-red-300";
  if (tone === "retry") return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  return "border-white/10 bg-white/[0.04] text-zinc-400";
}

function compactSubmissionLabel(state: SubmissionState) {
  if (state.tone === "success") return "Подтвержден";
  if (state.tone === "pending") return "Ждём соперника";
  if (state.tone === "danger") return "Спор";
  if (state.tone === "retry") return "Повторить";
  return "Ждет счет";
}

function formatSubmittedScore(score: SubmittedScore) {
  const regularScore = `${score.player1Score}:${score.player2Score}`;
  if (score.player1PenaltyScore === null || score.player1PenaltyScore === undefined) return regularScore;
  if (score.player2PenaltyScore === null || score.player2PenaltyScore === undefined) return regularScore;
  return `${regularScore} (${score.player1PenaltyScore}:${score.player2PenaltyScore})`;
}

function SubmissionBadge({ state, score, hidden }: { state: SubmissionState; score?: SubmittedScore; hidden?: boolean }) {
  if (hidden) return null;

  return (
    <div
      className={cn(
        "mt-1.5 flex max-w-full items-center justify-center gap-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-center text-[10px] leading-[1.35]",
        submissionToneClass(state.tone),
      )}
      title={score ? `${state.label}: ${formatSubmittedScore(score)}` : state.label}
    >
      <span className="truncate">{compactSubmissionLabel(state)}</span>
      {score ? (
        <>
          <span className="shrink-0 opacity-40">•</span>
          <span className="shrink-0 font-semibold text-white">{formatSubmittedScore(score)}</span>
        </>
      ) : null}
    </div>
  );
}

export function MyMatchCard({
  id,
  meta,
  isConfirmed,
  confirmedPlayer1Score,
  confirmedPlayer2Score,
  confirmedPlayer1PenaltyScore,
  confirmedPlayer2PenaltyScore,
  canSubmit,
  requiresPenaltyOnDraw,
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
  player1SubmittedScore,
  player2SubmittedScore,
  disputeHref,
  isDisputed,
}: MyMatchCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [player1ScoreInput, setPlayer1ScoreInput] = useState("");
  const [player2ScoreInput, setPlayer2ScoreInput] = useState("");
  const [drawScore, setDrawScore] = useState<SubmittedScore | null>(null);
  const [message, setMessage] = useState(helperText);
  const [isPending, startTransition] = useTransition();

  const hasConfirmedScore =
    confirmedPlayer1Score !== null &&
    confirmedPlayer1Score !== undefined &&
    confirmedPlayer2Score !== null &&
    confirmedPlayer2Score !== undefined;
  const hasConfirmedPenaltyScore =
    confirmedPlayer1PenaltyScore !== null &&
    confirmedPlayer1PenaltyScore !== undefined &&
    confirmedPlayer2PenaltyScore !== null &&
    confirmedPlayer2PenaltyScore !== undefined;
  const isPenaltyInputStep = Boolean(drawScore);

  const onSubmit = () => {
    const player1Score = Number(player1ScoreInput);
    const player2Score = Number(player2ScoreInput);

    if (!drawScore && requiresPenaltyOnDraw && player1Score === player2Score) {
      setDrawScore({ player1Score, player2Score });
      setPlayer1ScoreInput("");
      setPlayer2ScoreInput("");
      setMessage(`Ничья ${player1Score}:${player2Score}. Теперь в этих же полях укажите счёт пенальти.`);
      return;
    }

    startTransition(async () => {
      setMessage("Сохранение результата...");
      const payload = drawScore
        ? {
            player1Score: drawScore.player1Score,
            player2Score: drawScore.player2Score,
            player1PenaltyScore: player1Score,
            player2PenaltyScore: player2Score,
          }
        : {
            player1Score,
            player2Score,
          };
      const response = await fetch(`/api/matches/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({ error: "Не удалось обработать ответ сервера." }));
      setMessage(result.message ?? result.error ?? "Не удалось сохранить результат.");
      if (response.ok) {
        setPlayer1ScoreInput("");
        setPlayer2ScoreInput("");
        setDrawScore(null);
        const nextSearchParams = new URLSearchParams(searchParams.toString());
        nextSearchParams.set("tab", "my-matches");
        router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
        router.refresh();
      }
    });
  };

  const submitDisabled =
    isPending ||
    player1ScoreInput === "" ||
    player2ScoreInput === "" ||
    (isPenaltyInputStep && player1ScoreInput === player2ScoreInput);

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-lg border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] p-0 shadow-[0_14px_40px_rgba(0,0,0,0.22)] transition",
        isConfirmed && "border-emerald-400/25",
        isDisputed && "border-red-400/30 shadow-[0_14px_40px_rgba(29,29,29,0.14)]",
      )}
    >
      {meta ? (
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-black/20 px-3 py-1.5 text-[11px] text-zinc-500 sm:px-3.5">
          <Clock3 className="h-3 w-3 shrink-0 text-primary/70" />
          <span className="truncate">{meta}</span>
        </div>
      ) : null}

      <div className="p-2.5 sm:p-3.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 sm:gap-3">
          <div className="min-w-0">
            <ClubPlayerLine
              playerId={player1Id}
              playerName={player1Name}
              clubName={player1ClubName}
              badgePath={player1ClubBadgePath}
              stack
            />
            <SubmissionBadge state={player1SubmissionState} score={player1SubmittedScore} hidden={player1SubmissionState.tone === "success" && isConfirmed} />
          </div>

          <div className="flex min-w-[3.4rem] shrink-0 flex-col items-center gap-1 self-start sm:min-w-[3.8rem] sm:gap-1.5">
            <div
              className={cn(
                "flex items-center justify-center",
                // Match the club badge row height so the score centers against the badge + name block, not the nicknames.
                (player1ClubBadgePath || player2ClubBadgePath) && "min-h-8 sm:min-h-9",
              )}
            >
              {hasConfirmedScore ? (
                <div className="flex items-center gap-1 rounded-md border border-primary/15 bg-primary/[0.08] px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <span className="min-w-[1.55rem] text-center text-lg font-black tabular-nums text-primary sm:min-w-[1.8rem]">
                    {confirmedPlayer1Score}
                  </span>
                  <span className="text-xs font-semibold text-zinc-600">:</span>
                  <span className="min-w-[1.55rem] text-center text-lg font-black tabular-nums text-primary sm:min-w-[1.8rem]">
                    {confirmedPlayer2Score}
                  </span>
                </div>
              ) : canSubmit ? (
                <div className="flex min-h-11 items-center gap-1 rounded-md border border-white/10 bg-black/35 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    placeholder="0"
                    aria-label={isPenaltyInputStep ? "Пенальти, ваш счёт" : "Ваш счёт"}
                    value={player1ScoreInput}
                    onChange={(e) => setPlayer1ScoreInput(e.target.value)}
                    className="h-11 w-9 bg-transparent text-center text-xl font-black tabular-nums text-white caret-primary outline-none placeholder:text-zinc-700 [appearance:textfield] focus:text-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-base font-semibold text-zinc-600">:</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    placeholder="0"
                    aria-label={isPenaltyInputStep ? "Пенальти, счёт соперника" : "Счёт соперника"}
                    value={player2ScoreInput}
                    onChange={(e) => setPlayer2ScoreInput(e.target.value)}
                    className="h-11 w-9 bg-transparent text-center text-xl font-black tabular-nums text-white caret-primary outline-none placeholder:text-zinc-700 [appearance:textfield] focus:text-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              ) : (
                <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black tracking-[0.22em] text-zinc-500 sm:px-3">VS</div>
              )}
            </div>
            {canSubmit && !hasConfirmedScore && isPenaltyInputStep ? (
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">пен</span>
            ) : null}
            {hasConfirmedPenaltyScore ? (
              <div className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                пен {confirmedPlayer1PenaltyScore}:{confirmedPlayer2PenaltyScore}
              </div>
            ) : null}
            {isConfirmed ? (
              <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
                <Check className="h-3 w-3" />
                Готово
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            <ClubPlayerLine
              playerId={player2Id}
              playerName={player2Name}
              clubName={player2ClubName}
              badgePath={player2ClubBadgePath}
              stack
            />
            <SubmissionBadge state={player2SubmissionState} score={player2SubmittedScore} hidden={player2SubmissionState.tone === "success" && isConfirmed} />
          </div>
        </div>

        {canSubmit ? (
          <button
            onClick={onSubmit}
            disabled={submitDisabled}
            className="mt-2.5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-3 text-[10px] font-black uppercase tracking-[0.08em] text-black shadow-[0_2px_18px_rgba(33,241,168,0.22)] transition-all hover:bg-primary/90 hover:shadow-[0_2px_24px_rgba(33,241,168,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.99] disabled:pointer-events-none disabled:bg-white/10 disabled:text-zinc-500 disabled:shadow-none sm:mt-3 sm:text-[11px]"
          >
            <span className="truncate">{isPending ? "Отправка..." : isPenaltyInputStep ? "Отправить" : "Подтвердить"}</span>
          </button>
        ) : null}

        {canSubmit ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p aria-live="polite" className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-500">{message}</p>
            {attemptsLeft > 0 && !waitingForOpponent ? (
              <div className="flex shrink-0 items-center gap-1.5" title={`Осталось попыток: ${attemptsLeft}`}>
                <span className="hidden text-[10px] uppercase tracking-[0.1em] text-zinc-600 sm:inline">Попытки</span>
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        i < attemptsLeft ? "bg-emerald-400" : "bg-red-500",
                      )}
                    />
                  ))}
                </span>
              </div>
            ) : null}
          </div>
        ) : waitingForOpponent ? (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-zinc-400 sm:px-3 sm:py-2">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span>Результат отправлен — ждём подтверждения соперника.</span>
          </div>
        ) : isDisputed ? (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-red-400/20 bg-red-500/[0.07] px-2.5 py-1.5 sm:px-3 sm:py-2">
            <div className="flex min-w-0 items-center gap-2 text-[11px] text-red-200/80">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span className="truncate">Спор — результат выставит администрация.</span>
            </div>
            <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0 border-red-300/20 bg-red-500/10 px-3 text-xs text-red-100 hover:bg-red-500/20 hover:text-white">
              <Link href={disputeHref}>Открыть спор</Link>
            </Button>
          </div>
        ) : !isConfirmed && helperText ? (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[11px] leading-snug text-zinc-400 sm:px-3 sm:py-2">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span>{helperText}</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
