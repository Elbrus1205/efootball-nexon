import Link from "next/link";
import { ArrowUpRight, Crown, Medal, Shield, Sparkles, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getPlayerRatings } from "@/lib/ratings";

function rankStyle(rank: number) {
  if (rank === 1) return "border-amber-300/40 bg-amber-300/15 text-amber-200";
  if (rank === 2) return "border-zinc-200/30 bg-zinc-200/10 text-zinc-100";
  if (rank === 3) return "border-orange-300/35 bg-orange-300/15 text-orange-200";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4" />;
  if (rank <= 3) return <Medal className="h-4 w-4" />;
  return <span className="text-xs font-semibold">{rank}</span>;
}

export default async function RatingsPage() {
  const ratings = await getPlayerRatings();
  const podium = ratings.slice(0, 3);
  const activePlayers = ratings.filter((player) => player.played > 0).length;
  const totalMatches = ratings.reduce((sum, player) => sum + player.played, 0) / 2;

  return (
    <div className="page-shell space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(59,130,246,0.11)_45%,rgba(255,255,255,0.04))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              <Trophy className="h-4 w-4" />
              Рейтинги
            </div>
            <h1 className="mt-5 font-display text-4xl font-thin text-white sm:text-5xl">Рейтинг игроков</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              Все начинают с 500. После каждого подтвержденного матча рейтинг меняется по ожидаемому результату, а призеры завершенных турниров получают бонусные очки.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-2xl font-semibold text-white">{ratings.length}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">игроков</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-2xl font-semibold text-white">{activePlayers}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">с матчами</div>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-1">
              <div className="text-2xl font-semibold text-white">{totalMatches}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">матчей</div>
            </div>
          </div>
        </div>
      </section>

      {podium.length ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {podium.map((player, index) => {
            const rank = index + 1;

            return (
              <Card key={player.playerId} className="relative overflow-hidden p-5">
                <div className="absolute inset-x-0 top-0 h-1 bg-primary/70" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${rankStyle(rank)}`}>
                      <RankIcon rank={rank} />
                    </div>
                    <div className="min-w-0">
                      <Link href={`/players/${player.playerId}`} className="truncate font-semibold text-white transition hover:text-primary">
                        {player.playerName}
                      </Link>
                      <div className="mt-1 text-sm text-zinc-500">{player.played} матчей</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-white">{player.rating}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">очков</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="font-semibold text-white">Таблица рейтинга</div>
            <div className="mt-1 text-sm text-zinc-500">Elo-очки, статистика матчей и турнирные бонусы.</div>
          </div>
          <Badge variant="neutral">K = 30</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-[0.18em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Игрок</th>
                <th className="px-5 py-3 text-center">Рейтинг</th>
                <th className="px-5 py-3 text-center">Матчи</th>
                <th className="px-5 py-3 text-center">В</th>
                <th className="px-5 py-3 text-center">Н</th>
                <th className="px-5 py-3 text-center">П</th>
                <th className="px-5 py-3 text-center">+/-</th>
                <th className="px-5 py-3 text-center">Бонус</th>
                <th className="px-5 py-3 text-right">Профиль</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {ratings.map((player, index) => {
                const rank = index + 1;

                return (
                  <tr key={player.playerId} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${rankStyle(rank)}`}>
                        <RankIcon rank={rank} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20">
                          {player.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={player.image} alt={player.playerName} className="h-full w-full object-cover" />
                          ) : (
                            <Shield className="h-4 w-4 text-zinc-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">{player.playerName}</div>
                          <div className="mt-1 text-xs text-zinc-500">матч-рейтинг: {player.matchRating}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center text-lg font-black text-white">{player.rating}</td>
                    <td className="px-5 py-4 text-center text-zinc-300">{player.played}</td>
                    <td className="px-5 py-4 text-center text-emerald-300">{player.wins}</td>
                    <td className="px-5 py-4 text-center text-zinc-300">{player.draws}</td>
                    <td className="px-5 py-4 text-center text-rose-300">{player.losses}</td>
                    <td className={player.goalDifference >= 0 ? "px-5 py-4 text-center text-emerald-300" : "px-5 py-4 text-center text-rose-300"}>
                      {player.goalDifference > 0 ? `+${player.goalDifference}` : player.goalDifference}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                        <Sparkles className="h-3.5 w-3.5" />
                        +{player.bonus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/players/${player.playerId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:text-white">
                        Открыть
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
