"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, History, ListChecks, Medal, Search, Shield, Swords, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PlayerRow = {
  userId: string;
  division: number;
  points: number;
  rating: number | null;
  wins: number;
  draws: number;
  losses: number;
  winStreak: number;
  user: { id: string; name: string | null; email: string | null; telegramUsername: string | null };
};

type DivisionMatch = {
  id: string;
  playerOneId: string;
  playerTwoId: string;
  playerOneScore: number | null;
  playerTwoScore: number | null;
  status: string;
  deadlineAt: string | Date;
  createdAt: string | Date;
  autoResolved: boolean;
  playerOne: { id: string; name: string | null; email: string | null; telegramUsername: string | null; divisionProfile?: { division: number } | null };
  playerTwo: { id: string; name: string | null; email: string | null; telegramUsername: string | null; divisionProfile?: { division: number } | null };
  submissions?: { submittedById: string; playerOneScore: number; playerTwoScore: number; screenshotUrl: string | null }[];
};

type HistoryRow = {
  id: string;
  result: "WIN" | "DRAW" | "LOSS";
  playerScore: number;
  opponentScore: number;
  divisionBefore: number;
  divisionAfter: number;
  delta: number;
  createdAt: string | Date;
  match: { id: string; status: string };
  opponent?: { name: string | null; email: string | null; telegramUsername: string | null } | null;
};

type Leaderboard = {
  players: PlayerRow[];
  page: number;
  total: number;
  pageSize: number;
  from: number;
  to: number;
};

function displayName(user?: { name: string | null; email?: string | null; telegramUsername?: string | null } | null) {
  return user?.name || (user?.telegramUsername ? `@${user.telegramUsername}` : null) || user?.email || "Игрок";
}

function statusLabel(status: string) {
  if (status === "WAITING_GAME") return "Ожидает игру";
  if (status === "WAITING_CONFIRMATION") return "Ожидает подтверждение";
  if (status === "DISPUTED") return "Спорный матч";
  if (status === "FINISHED") return "Завершен";
  if (status === "CANCELLED") return "Отменен";
  return status;
}

function metric(player?: { division: number; points: number; rating: number | null } | null) {
  if (!player) return "0";
  return player.division <= 2 ? `${player.rating ?? 1000} рейтинга` : `${player.points} очков`;
}

function timeLeft(deadline: string | Date) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "авто-завершение скоро";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}ч ${minutes}м`;
}

function DivisionBadge({ division }: { division: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold", division <= 2 ? "border-amber-300/25 bg-amber-400/10 text-amber-100" : "border-sky-300/25 bg-sky-400/10 text-sky-100")}>
      Дивизион {division}
    </span>
  );
}

function ScoreForm({ match }: { match: DivisionMatch }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [playerOneScore, setPlayerOneScore] = useState(match.playerOneScore ?? 0);
  const [playerTwoScore, setPlayerTwoScore] = useState(match.playerTwoScore ?? 0);
  const [screenshotUrl, setScreenshotUrl] = useState("");

  return (
    <div className="grid gap-2 sm:grid-cols-[80px_80px_1fr_auto]">
      <Input className="h-10 bg-black/30" type="number" min={0} max={99} value={playerOneScore} onChange={(event) => setPlayerOneScore(Number(event.target.value))} />
      <Input className="h-10 bg-black/30" type="number" min={0} max={99} value={playerTwoScore} onChange={(event) => setPlayerTwoScore(Number(event.target.value))} />
      <Input className="h-10 bg-black/30" placeholder="Ссылка на скриншот" value={screenshotUrl} onChange={(event) => setScreenshotUrl(event.target.value)} />
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await fetch(`/api/divisions/matches/${match.id}/score`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerOneScore, playerTwoScore, screenshotUrl }),
            });
            const payload = await res.json().catch(() => null);
            if (!res.ok) {
              toast.error(payload?.error || "Не удалось отправить счет.");
              return;
            }
            toast.success("Счет отправлен.");
            router.refresh();
          })
        }
      >
        Ввести счет
      </Button>
    </div>
  );
}

export function DivisionModeClient({
  currentUserId,
  profile,
  queued,
  activeMatches,
  history,
  leaderboard,
  myLeaderboard,
  leaderboardPage,
  betaEnabled,
}: {
  currentUserId: string;
  profile: PlayerRow;
  queued: boolean;
  activeMatches: DivisionMatch[];
  history: HistoryRow[];
  leaderboard: Leaderboard;
  myLeaderboard: Leaderboard;
  leaderboardPage: number;
  betaEnabled: boolean;
}) {
  const [tab, setTab] = useState<"matches" | "rating" | "mine" | "history" | "rules">("matches");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const currentLeaderboard = tab === "mine" ? myLeaderboard : leaderboard;
  const finished = history.slice(0, 8);

  const tabs = useMemo(
    () => [
      { id: "matches", label: "Мои матчи", icon: Swords },
      { id: "rating", label: "Рейтинг", icon: Trophy },
      { id: "mine", label: "Мой рейтинг", icon: Medal },
      { id: "history", label: "История матчей", icon: History },
      { id: "rules", label: "Правила", icon: ListChecks },
    ] as const,
    [],
  );

  return (
    <div className="page-shell space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_15%_0%,rgba(56,189,248,0.16),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(3,7,18,0.88))] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.34)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-100">Beta</span>
              <DivisionBadge division={profile.division} />
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">{metric(profile)}</span>
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Beta testing</div>
              <h1 className="mt-2 font-display text-4xl font-thin text-white sm:text-5xl">Дивизион</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Режим находится в beta testing. Возможны изменения правил и баланса рейтинга.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
            <Button
              className="h-12 rounded-2xl"
              disabled={pending || queued || !betaEnabled}
              onClick={() =>
                startTransition(async () => {
                  const res = await fetch("/api/divisions/queue", { method: "POST" });
                  const payload = await res.json().catch(() => null);
                  if (!res.ok) {
                    toast.error(payload?.error || "Не удалось начать поиск.");
                    return;
                  }
                  toast.success(payload.status === "matched" ? "Соперник найден, матч создан." : "Вы в очереди поиска.");
                  router.refresh();
                })
              }
            >
              <Search className="mr-2 h-4 w-4" />
              {queued ? "Поиск идет" : "Найти игрока"}
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-2xl"
              disabled={pending || !queued}
              onClick={() =>
                startTransition(async () => {
                  await fetch("/api/divisions/queue", { method: "DELETE" });
                  toast.success("Поиск остановлен.");
                  router.refresh();
                })
              }
            >
              Отменить поиск
            </Button>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition", tab === item.id ? "border-primary/30 bg-primary/10 text-white" : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white")}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "matches" ? (
        <div className="grid gap-4">
          {activeMatches.length ? activeMatches.map((match) => {
            const opponent = match.playerOneId === currentUserId ? match.playerTwo : match.playerOne;
            return (
              <article key={match.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-primary/25 hover:bg-white/[0.06] sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <DivisionBadge division={opponent.divisionProfile?.division ?? 5} />
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-zinc-300">{statusLabel(match.status)}</span>
                    </div>
                    <div className="text-xl font-bold text-white">{displayName(opponent)}</div>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Clock className="h-4 w-4 text-primary" />
                      До авто-завершения: {timeLeft(match.deadlineAt)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-center">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Счет</div>
                    <div className="mt-1 text-3xl font-black text-white">{match.playerOneScore ?? "-"} : {match.playerTwoScore ?? "-"}</div>
                  </div>
                </div>
                {match.status !== "FINISHED" && match.status !== "CANCELLED" ? <div className="mt-4"><ScoreForm match={match} /></div> : null}
              </article>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-zinc-400">Активных матчей нет. Нажмите «Найти игрока», чтобы попасть в очередь.</div>
          )}
        </div>
      ) : null}

      {tab === "rating" || tab === "mine" ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Место</th>
                  <th className="px-4 py-3">Игрок</th>
                  <th className="px-4 py-3">Дивизион</th>
                  <th className="px-4 py-3">Рейтинг/очки</th>
                  <th className="px-4 py-3">Победы</th>
                  <th className="px-4 py-3">Поражения</th>
                  <th className="px-4 py-3">Серия</th>
                </tr>
              </thead>
              <tbody>
                {currentLeaderboard.players.map((player, index) => {
                  const place = (currentLeaderboard.page - 1) * currentLeaderboard.pageSize + index + 1;
                  const me = player.userId === currentUserId;
                  return (
                    <tr key={player.userId} className={cn("border-b border-white/5 last:border-0", me && "bg-primary/10 text-white")}>
                      <td className="px-4 py-3 font-black text-white">{place}</td>
                      <td className="px-4 py-3">{displayName(player.user)}</td>
                      <td className="px-4 py-3"><DivisionBadge division={player.division} /></td>
                      <td className="px-4 py-3">{metric(player)}</td>
                      <td className="px-4 py-3 text-emerald-200">{player.wins}</td>
                      <td className="px-4 py-3 text-red-200">{player.losses}</td>
                      <td className="px-4 py-3">{player.winStreak}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tab === "rating" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-500">{currentLeaderboard.from}-{currentLeaderboard.to} из {currentLeaderboard.total}</div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={leaderboardPage <= 1} onClick={() => router.push(`/divisions?page=${leaderboardPage - 1}`)}>Назад</Button>
                <Button variant="outline" disabled={currentLeaderboard.to >= currentLeaderboard.total} onClick={() => router.push(`/divisions?page=${leaderboardPage + 1}`)}>Далее</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="grid gap-3">
          {finished.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <div className="text-sm font-bold text-white">{displayName(row.opponent)}</div>
                <div className="text-xs text-zinc-500">{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(row.createdAt))}</div>
              </div>
              <div className="text-2xl font-black text-white">{row.playerScore}:{row.opponentScore}</div>
              <div className={cn("rounded-full px-3 py-1 text-xs font-bold", row.result === "WIN" ? "bg-emerald-400/10 text-emerald-200" : row.result === "LOSS" ? "bg-red-400/10 text-red-200" : "bg-zinc-400/10 text-zinc-200")}>
                {row.result === "WIN" ? "Победа" : row.result === "LOSS" ? "Поражение" : "Ничья"} · {row.delta > 0 ? "+" : ""}{row.delta}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "rules" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            ["Дивизионы 5-3", "Победа = 3 очка, ничья = 1, поражение = 0. Повышения: 30, 45 и 60 очков."],
            ["Дивизионы 2-1", "Во 2 дивизионе стартовый рейтинг 1000. Выше 1500 - повышение в 1 дивизион, ниже 900 - понижение."],
            ["Матчмейкинг", "Дивизионы 1-2 играют между собой, дивизионы 3-5 играют между собой."],
            ["Подтверждение", "Оба игрока вводят счет. Совпадает - матч завершен, не совпадает - спор уходит администратору."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-lg font-bold text-white"><Shield className="h-5 w-5 text-primary" />{title}</div>
              <p className="text-sm leading-6 text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
