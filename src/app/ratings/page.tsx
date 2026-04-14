import { Crown, Medal, Shield } from "lucide-react";
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

  return (
    <div className="page-shell space-y-8">
      <div className="text-sm font-semibold uppercase tracking-[0.28em] text-primary drop-shadow-[0_0_16px_rgba(59,130,246,0.65)]">Рейтинги</div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="font-semibold text-white">Таблица рейтинга</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-[0.18em] text-zinc-500">
              <tr>
                <th className="w-10 px-2 py-3 text-center">#</th>
                <th className="px-5 py-3">Игрок</th>
                <th className="px-5 py-3 text-center">Рейтинг</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {ratings.map((player, index) => {
                const rank = index + 1;

                return (
                  <tr key={player.playerId} className="transition hover:bg-white/[0.03]">
                    <td className="w-10 px-2 py-4">
                      <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg border ${rankStyle(rank)}`}>
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
