import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "@/components/players/player-profile.module.css";
import { PlayerAchievementsPanel } from "@/components/players/player-achievements-panel";
import { requireAuth } from "@/lib/auth/session";
import { getUserAchievementProgress, syncUserAchievements } from "@/lib/achievements";

export default async function DashboardAchievementsPage() {
  const session = await requireAuth();
  await syncUserAchievements(session.user.id);
  const achievements = await getUserAchievementProgress(session.user.id);

  return (
    <div className={`page-shell space-y-5 ${styles.page}`}>
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Назад в профиль
      </Link>

      <div className="space-y-2">
        <p className={styles.caption}>Профиль игрока</p>
        <h1 className={styles.name}>Достижения</h1>
      </div>

      <PlayerAchievementsPanel achievements={achievements} />
    </div>
  );
}
