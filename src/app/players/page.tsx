import Link from "next/link";
import { Search, Send } from "lucide-react";
import { ProfileStatusApprovalStatus } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { profileStatusClassName } from "@/lib/profile-status-style";
import { getUserSocialLinks } from "@/lib/social-links";

function VkMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13.1 18.1c-7.5 0-11.8-5.1-12-13.7h3.8c.1 6.3 2.9 9 5.1 9.5V4.4h3.6v5.4c2.2-.2 4.5-2.8 5.3-5.4h3.6c-.6 3.2-3.1 5.8-4.9 6.9 1.8.9 4.7 3.2 5.8 6.8h-4c-.8-2.5-2.9-4.4-5.8-4.7v4.7h-.5Z" />
    </svg>
  );
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const query = searchParams?.q?.trim() ?? "";
  const users = await db.user.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { publicId: { contains: query } },
            { id: { contains: query } },
          ],
        }
      : undefined,
    include: {
      accounts: {
        select: {
          provider: true,
          providerAccountId: true,
        },
      },
      profileStatuses: {
        where: { approvalStatus: ProfileStatusApprovalStatus.APPROVED, selectedOrder: { not: null } },
        orderBy: [{ selectedOrder: "asc" }, { createdAt: "desc" }],
        take: 3,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 80,
  });

  return (
    <div className="page-shell space-y-6">
      <div className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Пользователи</div>
        <h1 className="font-display text-3xl font-thin text-white">Игроки сайта</h1>
      </div>

      <form className="relative" action="/players">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input name="q" defaultValue={query} placeholder="Поиск по имени или ID" className="h-12 pl-11" />
      </form>

      <div className="grid gap-3">
        {users.map((user) => {
          const displayName = getPlayerDisplayName(user);
          const socialLinks = getUserSocialLinks(user);
          const telegram = socialLinks.find((link) => link.id === "telegram");
          const vk = socialLinks.find((link) => link.id === "vk");

          return (
            <Card key={user.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/players/${user.publicId}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary">
                  <Avatar className="h-12 w-12 rounded-2xl border border-white/10 bg-black/20">
                    <AvatarImage src={user.image || undefined} alt={displayName} />
                    <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white sm:text-base">{displayName}</span>
                    </div>
                    {user.profileStatuses.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {user.profileStatuses.map((status) => (
                          <span key={status.id} className={profileStatusClassName(status.tone, "min-h-6 px-2 text-[10px]")}>
                            {status.title}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-2">
                  {telegram ? (
                    <a
                      href={telegram.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Написать ${displayName} в Telegram`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-500/10 text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/20 hover:text-white"
                    >
                      <Send className="h-4 w-4" />
                    </a>
                  ) : null}

                  {vk ? (
                    <a
                      href={vk.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Написать ${displayName} во ВКонтакте`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-500/10 text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-500/20 hover:text-white"
                    >
                      <VkMark className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {!users.length ? <Card className="p-6 text-sm text-zinc-500">Пользователи не найдены.</Card> : null}
    </div>
  );
}
