"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Clock, Crown, History, ListChecks, Percent, Search, Swords, Trophy } from "lucide-react";
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
  playerOne: { id: string; name: string | null; email: string | null; telegramUsername: string | null; divisionProfile?: { division: number } | null };
  playerTwo: { id: string; name: string | null; email: string | null; telegramUsername: string | null; divisionProfile?: { division: number } | null };
};

type HistoryRow = {
  id: string;
  result: "WIN" | "DRAW" | "LOSS";
  playerScore: number;
  opponentScore: number;
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

type DivisionSettings = {
  phaseStartsAt: string | Date | null;
  phaseEndsAt: string | Date | null;
  rulesText: string | null;
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

function timeLeft(deadline: string | Date) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "скоро";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}ч ${minutes}м`;
}

function formatPhaseDate(value: string | Date | null) {
  if (!value) return "не задано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "не задано";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function promotionTarget(division: number) {
  if (division === 5) return 30;
  if (division === 4) return 45;
  if (division === 3) return 60;
  if (division === 2) return 1500;
  return null;
}

function divisionMatchLimit(division: number) {
  if (division === 5) return 15;
  if (division === 4) return 18;
  if (division === 3) return 22;
  return 10;
}

function scoreValue(player: PlayerRow) {
  return player.division <= 2 ? player.rating ?? 1000 : player.points;
}

function DivisionBadge({ division }: { division: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold", division <= 2 ? "border-amber-300/25 bg-amber-400/10 text-amber-100" : "border-sky-300/25 bg-sky-400/10 text-sky-100")}>
      Дивизион {division}
    </span>
  );
}

function DivisionSummary({ profile, settings, place }: { profile: PlayerRow; settings: DivisionSettings; place: number | null }) {
  const target = promotionTarget(profile.division);
  const isRatingDivision = profile.division <= 2;
  const value = scoreValue(profile);
  const maxForBar = target ?? Math.max(value, 1);
  const progress = Math.max(0, Math.min(100, (value / maxForBar) * 100));
  const totalGames = profile.wins + profile.draws + profile.losses;
  const matchLimit = divisionMatchLimit(profile.division);
  const pointsToPromotion = target ? Math.max(0, target - profile.points) : 0;
  const winPercent = totalGames ? Math.round((profile.wins / totalGames) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(28,28,34,0.96),rgba(18,18,24,0.96))] p-3.5 shadow-[0_16px_44px_rgba(2,6,23,0.3)] sm:rounded-[1.75rem] sm:p-6 sm:shadow-[0_24px_70px_rgba(2,6,23,0.34)]">
      <div className="flex flex-col gap-3 sm:gap-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-300/30 bg-blue-700/50 text-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.12)] sm:h-16 sm:w-16 sm:rounded-2xl">
            <Trophy className="h-4 w-4 sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="font-display text-lg font-black uppercase leading-none text-yellow-300 sm:text-5xl">Дивизион {profile.division}</h1>
              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-100 sm:px-3 sm:py-1 sm:text-xs sm:tracking-[0.18em]">Beta</span>
            </div>
            <div className="mt-0.5 truncate text-[10px] font-bold text-yellow-200/70 sm:mt-2 sm:text-xl sm:text-yellow-200">
              {formatPhaseDate(settings.phaseStartsAt)} — {formatPhaseDate(settings.phaseEndsAt)}
            </div>
          </div>
        </div>

        {isRatingDivision ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 sm:h-16 sm:w-16">
                  <BarChart3 className="h-5 w-5 sm:h-9 sm:w-9" />
                </span>
                <div>
                  <div className="text-xs font-bold text-zinc-500 sm:text-lg">Рейтинг</div>
                  <div className="text-2xl font-black leading-tight text-white sm:text-4xl">{profile.rating ?? 1000}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 sm:h-16 sm:w-16">
                  <Crown className="h-5 w-5 sm:h-9 sm:w-9" />
                </span>
                <div>
                  <div className="text-xs font-bold text-zinc-500 sm:text-lg">Место</div>
                  <div className="text-2xl font-black leading-tight text-white sm:text-4xl">{place ?? "-"}</div>
                </div>
              </div>
            </div>
            <p className="text-xs font-semibold text-zinc-400 sm:text-lg">
              {profile.division === 2 ? "Достигнув рейтинга 1500, вы перейдете в дивизион выше: 1." : "Держите рейтинг выше 900, чтобы сохранить место в первом дивизионе."}
            </p>
            <div className="border-t border-white/10 pt-3">
              <div className="grid grid-cols-3 gap-1.5 text-center sm:gap-3">
                <div className="overflow-hidden rounded-xl">
                  <div className="bg-emerald-400 py-1.5 text-xs font-black text-black sm:py-2 sm:text-lg">Победы</div>
                  <div className="mt-1.5 text-2xl font-black text-white sm:mt-2 sm:text-3xl">{profile.wins}</div>
                </div>
                <div className="overflow-hidden rounded-xl">
                  <div className="bg-zinc-400 py-1.5 text-xs font-black text-black sm:py-2 sm:text-lg">Ничьи</div>
                  <div className="mt-1.5 text-2xl font-black text-white sm:mt-2 sm:text-3xl">{profile.draws}</div>
                </div>
                <div className="overflow-hidden rounded-xl">
                  <div className="bg-red-500 py-1.5 text-xs font-black text-black sm:py-2 sm:text-lg">Поражения</div>
                  <div className="mt-1.5 text-2xl font-black text-white sm:mt-2 sm:text-3xl">{profile.losses}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 sm:mt-5 sm:pt-4">
                <div className="flex items-center gap-2 text-base font-black text-white sm:gap-3 sm:text-2xl">
                  <Percent className="h-6 w-6 rounded-full bg-emerald-400 p-1 text-black sm:h-8 sm:w-8 sm:p-1.5" />
                  Процент побед
                </div>
                <div className="text-xl font-black text-zinc-500 sm:text-3xl">{winPercent}%</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-black text-white sm:text-3xl">Текущие очки: {profile.points}</div>
            <div>
              <div className="relative h-6 overflow-hidden rounded-sm bg-zinc-600 sm:h-11">
                <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
              </div>
              <div className="mt-2 grid grid-cols-3 text-center text-xs font-black sm:text-sm">
                <span className="text-red-500">Вылет</span>
                <span className="text-emerald-400">Остаться</span>
                <span className="text-emerald-400">Повышение</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 sm:pt-4">
              <div className="flex items-center gap-2 text-xl font-black text-white sm:gap-3 sm:text-2xl"><Trophy className="h-6 w-6 text-yellow-300 sm:h-7 sm:w-7" />Матчи</div>
              <div className="text-xl font-black text-zinc-400 sm:text-2xl">{totalGames}/{matchLimit}</div>
            </div>
            <p className="text-sm font-bold text-zinc-400 sm:text-lg">
              {target && profile.points >= target ? "Вы уже набрали очки для повышения." : `До повышения осталось ${pointsToPromotion} очков из ${target ?? 0}.`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function ScoreForm({ match }: { match: DivisionMatch }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [playerOneScore, setPlayerOneScore] = useState(match.playerOneScore ?? 0);
  const [playerTwoScore, setPlayerTwoScore] = useState(match.playerTwoScore ?? 0);
  const [screenshotUrl, setScreenshotUrl] = useState("");

  return (
    <div className="grid gap-2 sm:grid-cols-[72px_72px_1fr_auto]">
      <Input className="h-9 bg-black/30 text-sm sm:h-10" type="number" min={0} max={99} value={playerOneScore} onChange={(event) => setPlayerOneScore(Number(event.target.value))} />
      <Input className="h-9 bg-black/30 text-sm sm:h-10" type="number" min={0} max={99} value={playerTwoScore} onChange={(event) => setPlayerTwoScore(Number(event.target.value))} />
      <Input className="h-9 bg-black/30 text-sm sm:h-10" placeholder="Ссылка на скриншот" value={screenshotUrl} onChange={(event) => setScreenshotUrl(event.target.value)} />
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

function LeaderboardTable({ leaderboard, currentUserId, offset = 0 }: { leaderboard: Leaderboard; currentUserId: string; offset?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
      <table className="min-w-[460px] w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-zinc-500">
          <tr>
            <th className="px-4 py-3">Место</th>
            <th className="px-4 py-3">Игрок</th>
            <th className="px-4 py-3">Рейтинг</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.players.map((player, index) => {
            const place = (leaderboard.page - 1) * leaderboard.pageSize + index + 1 + offset;
            const me = player.userId === currentUserId;
            return (
              <tr key={`${player.userId}-${offset}`} className={cn("border-b border-white/5 last:border-0", me && "bg-primary/10 text-white")}>
                <td className="px-4 py-3 font-black text-white">{place}</td>
                <td className="px-4 py-3">{displayName(player.user)}</td>
                <td className="px-4 py-3 font-bold text-yellow-200">{scoreValue(player)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  settings,
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
  settings: DivisionSettings;
}) {
  const [tab, setTab] = useState<"matches" | "rating" | "history" | "rules">("matches");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const finished = history.slice(0, 8);
  const myRowInTop = leaderboard.players.some((player) => player.userId === currentUserId);
  const myPlace = useMemo(() => {
    const all = myLeaderboard.players;
    const index = all.findIndex((player) => player.userId === currentUserId);
    return index >= 0 ? (myLeaderboard.page - 1) * myLeaderboard.pageSize + index + 1 : null;
  }, [currentUserId, myLeaderboard]);

  const tabs = useMemo(
    () => [
      { id: "matches", label: "Мои матчи", icon: Swords },
      { id: "rating", label: "Рейтинг", icon: Trophy },
      { id: "history", label: "История матчей", icon: History },
      { id: "rules", label: "Правила", icon: ListChecks },
    ] as const,
    [],
  );

  return (
    <div className="page-shell space-y-6">
      <DivisionSummary profile={profile} settings={settings} place={myPlace} />

      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-10 rounded-2xl text-sm sm:h-12 sm:text-base"
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
          <Search className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
          {queued ? "Поиск идет" : "Найти игрока"}
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-2xl text-sm sm:h-12 sm:text-base"
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

      <div className="flex gap-1.5 overflow-x-auto pb-1 sm:gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm", tab === item.id ? "border-primary/30 bg-primary/10 text-white" : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white")}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
              <article key={match.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 transition hover:border-primary/25 hover:bg-white/[0.06] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DivisionBadge division={opponent.divisionProfile?.division ?? 5} />
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-zinc-300 sm:px-2.5 sm:py-1 sm:text-xs">{statusLabel(match.status)}</span>
                    </div>
                    <div className="truncate text-base font-bold text-white sm:text-xl">{displayName(opponent)}</div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 sm:text-sm">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                      До авто-завершения: {timeLeft(match.deadlineAt)}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center sm:rounded-2xl sm:px-5 sm:py-3">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 sm:text-xs">Счет</div>
                    <div className="mt-0.5 text-xl font-black text-white sm:mt-1 sm:text-3xl">{match.playerOneScore ?? "-"} : {match.playerTwoScore ?? "-"}</div>
                  </div>
                </div>
                {match.status !== "FINISHED" && match.status !== "CANCELLED" ? <div className="mt-3 sm:mt-4"><ScoreForm match={match} /></div> : null}
              </article>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-zinc-400">Активных матчей нет. Нажмите «Найти игрока», чтобы попасть в очередь.</div>
          )}
        </div>
      ) : null}

      {tab === "rating" ? (
        <div className="space-y-4">
          <LeaderboardTable leaderboard={leaderboard} currentUserId={currentUserId} />
          {!myRowInTop ? (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Ваше место</div>
              <LeaderboardTable leaderboard={myLeaderboard} currentUserId={currentUserId} />
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-500">{leaderboard.from}-{leaderboard.to} из {leaderboard.total}</div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={leaderboardPage <= 1} onClick={() => router.push(`/divisions?page=${leaderboardPage - 1}`)}>Назад</Button>
              <Button variant="outline" disabled={leaderboard.to >= leaderboard.total} onClick={() => router.push(`/divisions?page=${leaderboardPage + 1}`)}>Далее</Button>
            </div>
          </div>
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          {settings.rulesText ? (
            <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">{settings.rulesText}</div>
          ) : (
            <div className="text-sm text-zinc-500">Правила пока не заполнены. Администратор сможет добавить их в панели дивизиона.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
