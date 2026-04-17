import { UserRole } from "@prisma/client";
import { userRoleLabel } from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getActiveUserBan } from "@/lib/user-ban";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DeleteUserAccountForm } from "@/components/admin/delete-user-account-form";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string; updated?: string; error?: string };
}) {
  const session = await requireRole([UserRole.ADMIN]);

  const query = searchParams?.q?.trim() ?? "";
  const returnTo = query ? `/admin/users?q=${encodeURIComponent(query)}` : "/admin/users";
  const users = await db.user.findMany({
    where: query
      ? {
          OR: [
            { nickname: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { telegramUsername: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="page-shell space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-thin text-white">Пользователи</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Найдите игрока по никнейму, имени, email или Telegram. Бан запрещает регистрацию в турнирах, а вечный бан также блокирует вход.
        </p>
      </div>

      <form className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-[1fr_auto]" action="/admin/users">
        <Input name="q" defaultValue={query} placeholder="Поиск игрока по никнейму" />
        <Button type="submit" variant="secondary">
          Найти
        </Button>
      </form>

      {searchParams?.updated ? <Card className="border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">{searchParams.updated}</Card> : null}
      {searchParams?.error ? <Card className="border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">{searchParams.error}</Card> : null}

      <div className="grid gap-4">
        {users.map((user) => {
          const activeBan = getActiveUserBan(user);
          const isCurrentUser = user.id === session.user.id;

          return (
            <Card key={user.id} className="space-y-5 p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">{user.nickname ?? user.name ?? user.email ?? "Игрок без имени"}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {user.email ?? user.telegramUsername ?? "social login"} • {userRoleLabel[user.role]}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                    {user.nickname ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Ник: {user.nickname}</span> : null}
                    {user.telegramUsername ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">TG: @{user.telegramUsername}</span> : null}
                  </div>
                  {activeBan ? (
                    <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      {activeBan.isPermanent ? "Забанен навсегда" : `Забанен до ${formatDate(activeBan.until)}`}
                      {activeBan.reason ? <span className="block text-rose-200/80">Причина: {activeBan.reason}</span> : null}
                    </div>
                  ) : null}
                </div>

                <form action={`/api/admin/users/${user.id}/role`} method="post" className="flex flex-wrap gap-2">
                  <select name="role" defaultValue={user.role} className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white">
                    <option value="PLAYER">{userRoleLabel.PLAYER}</option>
                    <option value="JUDGE">{userRoleLabel.JUDGE}</option>
                    <option value="HEAD_JUDGE">{userRoleLabel.HEAD_JUDGE}</option>
                    <option value="MODERATOR">{userRoleLabel.MODERATOR}</option>
                    <option value="ADMIN">{userRoleLabel.ADMIN}</option>
                  </select>
                  <Button type="submit" variant="outline">
                    Сохранить роль
                  </Button>
                </form>
              </div>

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                <form action={`/api/admin/users/${user.id}/ban`} method="post" className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <input type="hidden" name="action" value="permanent" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <div>
                    <div className="text-sm font-medium text-white">Бан навсегда</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {isCurrentUser ? "Свой аккаунт забанить нельзя." : "Игрок не сможет войти и участвовать."}
                    </div>
                  </div>
                  <Input name="reason" placeholder="Причина" />
                  <Button type="submit" className="w-full bg-rose-500 text-white hover:bg-rose-500/90" disabled={isCurrentUser}>
                    Забанить навсегда
                  </Button>
                </form>

                <form action={`/api/admin/users/${user.id}/ban`} method="post" className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(0,0,0,0.18))] p-4">
                  <input type="hidden" name="action" value="temporary" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <div>
                    <div className="text-sm font-medium text-white">Временный бан</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {isCurrentUser ? "Свой аккаунт забанить нельзя." : "Игрок не сможет регистрироваться в турнирах до даты."}
                    </div>
                  </div>
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-amber-200/80">Дата окончания</span>
                    <Input
                      name="bannedUntil"
                      type="datetime-local"
                      required
                      className="min-w-0 max-w-full appearance-none border-amber-300/20 bg-black/30 px-3 text-[13px] text-amber-50 [color-scheme:dark] sm:px-4 sm:text-sm"
                    />
                  </label>
                  <Input name="reason" placeholder="Причина" />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                    disabled={isCurrentUser}
                  >
                    Выдать временный бан
                  </Button>
                </form>

                <form action={`/api/admin/users/${user.id}/ban`} method="post" className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <input type="hidden" name="action" value="unban" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <div>
                    <div className="text-sm font-medium text-white">Снять бан</div>
                    <div className="mt-1 text-xs text-zinc-500">Очистит статус, срок и причину блокировки.</div>
                  </div>
                  <Button type="submit" variant="secondary" className="w-full" disabled={!activeBan}>
                    Разбанить
                  </Button>
                </form>
                <DeleteUserAccountForm userId={user.id} disabled={user.id === session.user.id} />
              </div>
            </Card>
          );
        })}
      </div>

      {!users.length ? <Card className="p-6 text-sm text-zinc-500">Игроки не найдены.</Card> : null}
    </div>
  );
}
