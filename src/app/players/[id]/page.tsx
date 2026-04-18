import { notFound } from "next/navigation";
import { PlayerCareerStatsPanel } from "@/components/players/player-career-stats";
import { PlayerSocialLinks } from "@/components/players/player-social-links";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { getPlayerCareerStats } from "@/lib/player-stats";
import { getUserSocialLinks } from "@/lib/social-links";
import { formatDate } from "@/lib/utils";

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const user = await db.user.findUnique({
    where: { id: params.id },
    include: {
      accounts: {
        select: {
          provider: true,
          providerAccountId: true,
        },
      },
    },
  });

  if (!user) notFound();

  const socialLinks = getUserSocialLinks(user);
  const careerStats = await getPlayerCareerStats(user.id);

  return (
    <div className="page-shell space-y-8">
      <Card className="p-6">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-thin text-white">{getPlayerDisplayName(user)}</h1>
          <div className="grid gap-3 text-sm text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
            <div>Имя: {user.name ?? "Не указано"}</div>
            <div>На платформе: {formatDate(user.createdAt, "d MMM yyyy")}</div>
            {socialLinks.length > 0 ? (
              <div className="sm:col-span-2 lg:col-span-1">
                <PlayerSocialLinks links={socialLinks} />
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <PlayerCareerStatsPanel stats={careerStats} />
    </div>
  );
}
