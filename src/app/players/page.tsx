import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Search, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TelegramProfileLink } from "@/components/telegram-profile-link";
import { UserRoleBadge } from "@/components/users/user-role-badge";
import { ProfileStatusBadge } from "@/components/profile/profile-status-badge";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { getSelectedProfileStatusWhere } from "@/lib/profile-status-query";
import { getUserSocialLinks } from "@/lib/social-links";

const PLAYER_PAGE_SIZE = 12;
const MAX_PLAYER_PAGE = 100;
const MAX_PLAYER_QUERY_LENGTH = 80;
const MAX_MEMORY_PLAYER_PAGES = 128;
const playerPageLoads = new Map<string, Promise<Awaited<ReturnType<typeof loadPlayerRows>>>>();
const playerPageValues = new Map<string, { expiresAt: number; value: Awaited<ReturnType<typeof loadPlayerRows>> }>();

async function loadPlayerRows(query: string, page: number) {
  return db.user.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { publicId: { contains: query } },
            { id: { contains: query } },
          ],
        }
      : undefined,
    select: {
      id: true,
      publicId: true,
      name: true,
      image: true,
      role: true,
      telegramId: true,
      telegramUsername: true,
      vkId: true,
      accounts: { select: { provider: true, providerAccountId: true } },
      profileStatuses: {
        where: getSelectedProfileStatusWhere(),
        orderBy: [{ selectedOrder: "asc" as const }, { createdAt: "desc" as const }],
        take: 3,
        select: { id: true, title: true, tone: true, type: true },
      },
    },
    orderBy: [{ createdAt: "desc" as const }],
    skip: (page - 1) * PLAYER_PAGE_SIZE,
    take: PLAYER_PAGE_SIZE + 1,
  });
}

const getCachedPlayerRows = unstable_cache(loadPlayerRows, ["public-player-directory"], {
  revalidate: 60,
  tags: ["public-player-directory"],
});

function getPlayerRows(query: string, page: number) {
  const key = `${query.toLocaleLowerCase("ru-RU")}:${page}`;
  const cached = playerPageValues.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  if (cached) playerPageValues.delete(key);
  const existing = playerPageLoads.get(key);
  if (existing) return existing;

  const pending = getCachedPlayerRows(query, page)
    .then((value) => {
      playerPageValues.set(key, { expiresAt: Date.now() + 60_000, value });
      while (playerPageValues.size > MAX_MEMORY_PLAYER_PAGES) {
        const oldestKey = playerPageValues.keys().next().value;
        if (!oldestKey) break;
        playerPageValues.delete(oldestKey);
      }
      return value;
    })
    .finally(() => playerPageLoads.delete(key));
  playerPageLoads.set(key, pending);
  return pending;
}

function VkMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13.1 18.1c-7.5 0-11.8-5.1-12-13.7h3.8c.1 6.3 2.9 9 5.1 9.5V4.4h3.6v5.4c2.2-.2 4.5-2.8 5.3-5.4h3.6c-.6 3.2-3.1 5.8-4.9 6.9 1.8.9 4.7 3.2 5.8 6.8h-4c-.8-2.5-2.9-4.4-5.8-4.7v4.7h-.5Z" />
    </svg>
  );
}

export default async function PlayersPage(
  props: {
    searchParams?: Promise<{ q?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const query = (searchParams?.q?.trim() ?? "").slice(0, MAX_PLAYER_QUERY_LENGTH);
  const requestedPage = Number.parseInt(searchParams?.page ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, MAX_PLAYER_PAGE) : 1;
  const rows = await getPlayerRows(query, page);
  const hasNextPage = rows.length > PLAYER_PAGE_SIZE;
  const users = rows.slice(0, PLAYER_PAGE_SIZE);

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (targetPage > 1) params.set("page", String(targetPage));
    const suffix = params.toString();
    return suffix ? `/players?${suffix}` : "/players";
  }

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
                    <div className="flex min-w-0 max-w-full items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white sm:text-base">{displayName}</span>
                      <UserRoleBadge role={user.role} className="max-w-[38vw] sm:max-w-none" />
                    </div>
                    {user.profileStatuses.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {user.profileStatuses.map((status) => (
                          <ProfileStatusBadge key={status.id} status={status} className="sm:min-h-6 sm:px-2 sm:text-[10px]" />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-2">
                  {telegram ? (
                    <TelegramProfileLink
                      {...(telegram.telegramProfile ?? { href: telegram.href })}
                      ariaLabel={`Написать ${displayName} в Telegram`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-500/10 text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/20 hover:text-white"
                    >
                      <Send className="h-4 w-4" />
                    </TelegramProfileLink>
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

      {page > 1 || hasNextPage ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Страницы игроков">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:border-primary/50 hover:text-white">
              Назад
            </Link>
          ) : <span />}
          <span className="text-sm text-zinc-500">Страница {page}</span>
          {hasNextPage ? (
            <Link href={pageHref(page + 1)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:border-primary/50 hover:text-white">
              Дальше
            </Link>
          ) : <span />}
        </nav>
      ) : null}

      {!users.length ? <Card className="p-6 text-sm text-zinc-500">Пользователи не найдены.</Card> : null}
    </div>
  );
}
