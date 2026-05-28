import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlayerAchievementsPanel } from "@/components/players/player-achievements-panel";
import { requireAuth } from "@/lib/auth/session";
import { getUserAchievementProgress, syncUserAchievements } from "@/lib/achievements";

export default async function DashboardAchievementsPage() {
  const session = await requireAuth();
  await syncUserAchievements(session.user.id);
  const achievements = await getUserAchievementProgress(session.user.id);

  return (
    <div className="page-shell space-y-5">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Назад в профиль
      </Link>

      <div className="space-y-2">
        <Badge variant="primary">Профиль игрока</Badge>
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">Достижения</h1>
      </div>

      <PlayerAchievementsPanel achievements={achievements} />
    </div>
  );
}
