import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <div className="page-shell space-y-5">
      <Link href={`/players/${user.publicId}`} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Назад в профиль
      </Link>

      <div className="space-y-2">
        <Badge variant="primary">Профиль игрока</Badge>
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">Достижения {displayName}</h1>
      </div>

      <PlayerAchievementsPanel achievements={achievements} />
    </div>
  );
}
