import { UserRole } from "@prisma/client";
import Link from "next/link";
import { userRoleLabel } from "@/lib/admin-display";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getActiveUserBan } from "@/lib/user-ban";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DeleteUserAccountForm } from "@/components/admin/delete-user-account-form";
import { TransferUserAccountForm } from "@/components/admin/transfer-user-account-form";
import { UserResetActions } from "@/components/admin/user-reset-actions";

type UsersFilter = "all" | "permanent" | "temporary" | "warnings";

function resolveFilter(value?: string): UsersFilter {
  return value === "permanent" || value === "temporary" || value === "warnings" ? value : "all";
}

function buildUsersHref(query: string, filter: UsersFilter) {
  const params = [query ? `q=${encodeURIComponent(query)}` : "", filter !== "all" ? `filter=${filter}` : ""].filter(Boolean).join("&");
  return `/admin/users${params ? `?${params}` : ""}`;
}

export default async function AdminUsersPage(
  props: {
    searchParams?: Promise<{ q?: string; filter?: string; updated?: string; error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await requireAnyPermission(["users.view", "users.ban", "users.changeLowerRoles"]);

  const query = searchParams?.q?.trim() ?? "";
  const filter = resolveFilter(searchParams?.filter);
  const returnTo = buildUsersHref(query, filter);
  const now = new Date();

  const searchWhere = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { telegramUsername: { contains: query, mode: "insensitive" as const } },
          { publicId: { contains: query } },
        ],
      }
    : {};
  const filterWhere =
    filter === "permanent"
      ? { isBanned: true }
      : filter === "temporary"
        ? { isBanned: false, bannedUntil: { gt: now } }
        : filter === "warnings"
          ? { warningsReceived: { some: {} } }
          : {};

  const [users, permanentBanCount, temporaryBanCount, warningsUserCount] = await Promise.all([
    db.user.findMany({
      where: { AND: [searchWhere, filterWhere] },
      include: {
        warningsReceived: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { issuedBy: { select: { name: true, email: true } } },
        },
        _count: { select: { warningsReceived: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.user.count({ where: { isBanned: true } }),
    db.user.count({ where: { isBanned: false, bannedUntil: { gt: now } } }),
    db.user.count({ where: { warningsReceived: { some: {} } } }),
  ]);

  const filterLinks: Array<{ id: UsersFilter; label: string; count: number | null }> = [
    { id: "all", label: "Все", count: null },
    { id: "permanent", label: "Бан навсегда", count: permanentBanCount },
    { id: "temporary", label: "Временный бан", count: temporaryBanCount },
    { id: "warnings", label: "Предупреждения", count: warningsUserCount },
  ];

  return (
    <div className="page-shell space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-thin text-white">Пользователи</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Поиск игроков, роли, предупреждения и ограничения участия в турнирах.
        </p>
      </div>

      <form className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-[1fr_auto]" action="/admin/users">
        <Input name="q" defaultValue={query} placeholder="Поиск по ID игрока, имени, email или Telegram" />
        {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
        <Button type="submit" variant="secondary" className="rounded-lg">
          Найти
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {filterLinks.map((item) => {
          const active = filter === item.id;
          return (
            <Button key={item.id} asChild variant={active ? "secondary" : "outline"} className="h-10 rounded-lg px-3 text-xs sm:text-sm">
              <Link href={buildUsersHref(query, item.id)}>
                {item.label}
                {item.count !== null ? <span className="ml-2 rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px]">{item.count}</span> : null}
              </Link>
            </Button>
          );
        })}
      </div>

      {searchParams?.updated ? <Card className="border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">{searchParams.updated}</Card> : null}
      {searchParams?.error ? <Card className="border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">{searchParams.error}</Card> : null}

      <div className="grid gap-3">
        {users.map((user) => {
          const activeBan = getActiveUserBan(user);
          const isCurrentUser = user.id === session.user.id;
          const isFounder = user.role === UserRole.FOUNDER;
          const warningCount = user._count.warningsReceived;

          return (
            <Card key={user.id} className="overflow-hidden rounded-lg p-0">
              <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-semibold text-white">{user.name ?? user.email ?? "Игрок без имени"}</div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300">{userRoleLabel[user.role]}</span>
                    {warningCount > 0 ? (
                      <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100">
                        Предупреждения {warningCount}/3
                      </span>
                    ) : null}
                    {activeBan ? (
                      <span className="rounded-full border border-rose-300/25 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-100">
                        {activeBan.isPermanent ? "Бан навсегда" : `Бан до ${formatDate(activeBan.until)}`}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-zinc-500">{user.email ?? user.telegramUsername ?? "social login"}</div>
                  <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">ID игрока: {user.publicId}</span>
                    {user.telegramUsername ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">TG: @{user.telegramUsername}</span> : null}
                  </div>
                </div>

                {isFounder ? (
                  <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    Роль основателя нельзя изменить.
                  </div>
                ) : (
                  <form action={`/api/admin/users/${user.id}/role`} method="post" className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <select name="role" defaultValue={user.role} className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
                      <option value="PLAYER">{userRoleLabel.PLAYER}</option>
                      <option value="JUDGE">{userRoleLabel.JUDGE}</option>
                      <option value="TRAINEE">{userRoleLabel.TRAINEE}</option>
                      <option value="ADMIN">{userRoleLabel.ADMIN}</option>
                      <option value="ORGANIZER">{userRoleLabel.ORGANIZER}</option>
                    </select>
                    <Button type="submit" variant="outline" className="h-10 rounded-lg px-3">
                      Сохранить
                    </Button>
                  </form>
                )}
              </div>

              <details className="border-t border-white/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.03]">
                  <span>Управление пользователем</span>
                  <span className="text-xs text-zinc-500">Открыть</span>
                </summary>

                <div className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-6">
                  <form action={`/api/admin/users/${user.id}/warning`} method="post" className="min-w-0 space-y-3 rounded-lg border border-amber-300/20 bg-amber-500/[0.06] p-4">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <div>
                      <div className="text-sm font-semibold text-white">Предупреждение</div>
                      <div className="mt-1 text-xs text-zinc-500">После 3-го предупреждения игрок не сможет участвовать в турнирах 120 дней.</div>
                    </div>
                    <Input name="reason" placeholder="Причина" />
                    <Button type="submit" variant="outline" className="w-full rounded-lg border-amber-400/30 bg-amber-500/10 text-amber-100" disabled={isCurrentUser || warningCount >= 3}>
                      Выдать предупреждение
                    </Button>
                  </form>

                  <div className="min-w-0 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
                    <div>
                      <div className="text-sm font-semibold text-white">История предупреждений</div>
                      <div className="mt-1 text-xs text-zinc-500">Показаны последние 3 записи.</div>
                    </div>
                    {user.warningsReceived.length ? (
                      <div className="space-y-2">
                        {user.warningsReceived.map((warning) => (
                          <div key={warning.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs text-zinc-300">
                            <div className="font-medium text-amber-100">{formatDate(warning.createdAt)}</div>
                            <div className="mt-1 line-clamp-2">{warning.reason || "Без причины"}</div>
                            <div className="mt-1 text-zinc-500">Выдал: {warning.issuedBy.name ?? warning.issuedBy.email ?? "админ"}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">Предупреждений нет.</div>
                    )}
                  </div>

                  <form action={`/api/admin/users/${user.id}/ban`} method="post" className="min-w-0 space-y-3 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-4">
                    <input type="hidden" name="action" value="permanent" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <div>
                      <div className="text-sm font-semibold text-white">Бан навсегда</div>
                      <div className="mt-1 text-xs text-zinc-500">Игрок не сможет войти и участвовать.</div>
                    </div>
                    <Input name="reason" placeholder="Причина" />
                    <Button type="submit" className="w-full rounded-lg bg-rose-500 text-white hover:bg-rose-500/90" disabled={isCurrentUser}>
                      Забанить навсегда
                    </Button>
                  </form>

                  <form action={`/api/admin/users/${user.id}/ban`} method="post" className="min-w-0 space-y-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4">
                    <input type="hidden" name="action" value="temporary" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <div>
                      <div className="text-sm font-semibold text-white">Временный бан</div>
                      <div className="mt-1 text-xs text-zinc-500">Запрет регистрации в турнирах до даты.</div>
                    </div>
                    <Input name="bannedUntil" type="datetime-local" required className="[color-scheme:dark]" />
                    <Input name="reason" placeholder="Причина" />
                    <Button type="submit" variant="outline" className="w-full rounded-lg border-amber-400/30 bg-amber-500/10 text-amber-100" disabled={isCurrentUser}>
                      Выдать временный бан
                    </Button>
                  </form>

                  <form action={`/api/admin/users/${user.id}/ban`} method="post" className="min-w-0 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
                    <input type="hidden" name="action" value="unban" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <div>
                      <div className="text-sm font-semibold text-white">Снять бан</div>
                      <div className="mt-1 text-xs text-zinc-500">Очистит статус, срок и причину.</div>
                    </div>
                    <Button type="submit" variant="secondary" className="w-full rounded-lg" disabled={!activeBan}>
                      Разбанить
                    </Button>
                  </form>

                  <div className="grid gap-3 lg:col-span-2 xl:col-span-1">
                    <TransferUserAccountForm userId={user.id} returnTo={returnTo} disabled={isCurrentUser} />
                    <UserResetActions userId={user.id} returnTo={returnTo} disabled={isCurrentUser} />
                    <DeleteUserAccountForm userId={user.id} disabled={isCurrentUser} />
                  </div>
                </div>
              </details>
            </Card>
          );
        })}
      </div>

      {!users.length ? <Card className="p-6 text-sm text-zinc-500">Игроки не найдены.</Card> : null}
    </div>
  );
}
