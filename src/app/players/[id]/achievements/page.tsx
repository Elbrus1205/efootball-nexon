import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import styles from "@/components/players/player-profile.module.css";
import { PlayerAchievementsPanel } from "@/components/players/player-achievements-panel";
import { getUserAchievementProgress } from "@/lib/achievements";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";

export default async function PlayerAchievementsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await db.user.findFirst({
    where: {
      OR: [{ id: params.id }, { publicId: params.id }],
    },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
    },
  });

  if (!user) notFound();

  const achievements = await getUserAchievementProgress(user.id);
  const displayName = getPlayerDisplayName(user);

  return (
    <div className={`page-shell space-y-5 ${styles.page}`}>
      <Link href={`/players/${user.publicId}`} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Назад в профиль
      </Link>

      <div className="space-y-2">
        <p className={styles.caption}>Профиль игрока · {displayName}</p>
        <h1 className={styles.name}>Достижения</h1>
      </div>

      <PlayerAchievementsPanel achievements={achievements} />
    </div>
  );
}
