import Link from "next/link";
import { getPlayerRatings } from "@/lib/ratings";
import { db } from "@/lib/db";
import s from "@/app/home.module.css";

export async function TopPlayers() {
  try {
    const ratings = (await getPlayerRatings()).slice(0, 3);
    const players = await db.user.findMany({
      where: { id: { in: ratings.map((row) => row.playerId) } },
      select: { id: true, publicId: true },
    });
    const publicIds = new Map(players.map((player) => [player.id, player.publicId]));
    if (!ratings.length) return <div className={s.emptyInline}>Рейтинг появится после первых подтверждённых матчей.</div>;
    return <div className={s.playersList}>
      {ratings.map((player, index) => <Link className={s.playerRow} href={publicIds.get(player.playerId) ? `/players/${publicIds.get(player.playerId)}` : "/players"} key={player.playerId}>
        <span className={s.playerRank}>0{index + 1}</span>
        <span className={s.playerName}>{player.playerName}</span>
        <span className={s.playerMetric}><strong>{player.rating}</strong><small>rating</small></span>
        <span className={s.playerMetric}><strong>{player.wins}</strong><small>wins</small></span>
      </Link>)}
    </div>;
  } catch {
    return <div className={s.emptyInline}>Рейтинг временно недоступен. Откройте раздел рейтинга, чтобы повторить попытку.</div>;
  }
}
