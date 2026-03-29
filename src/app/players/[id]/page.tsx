import { Globe } from "lucide-react";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
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
                Соцсети:
                <div className="mt-2 flex flex-wrap gap-2">
                  {socialLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white transition hover:border-primary/40 hover:text-primary"
                    >
                      <Globe className="h-4 w-4" />
                      <span>{link.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
