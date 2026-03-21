import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";

export default async function AdminUsersPage() {
  await requireRole([UserRole.ADMIN]);
  const users = await db.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="page-shell space-y-6">
      <h1 className="font-display text-3xl font-semibold text-white">Пользователи</h1>
      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium text-white">{user.nickname ?? user.name ?? user.email}</div>
              <div className="text-sm text-zinc-500">
                {user.email ?? user.telegramUsername ?? "social login"} • {user.role}
              </div>
            </div>
            <div className="flex gap-2">
              <form action={`/api/admin/users/${user.id}/role`} method="post">
                <select name="role" defaultValue={user.role} className="h-11 rounded-xl bg-black/30 px-4 text-white">
                  <option value="PLAYER">PLAYER</option>
                  <option value="MODERATOR">MODERATOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <button className="ml-2 h-11 rounded-xl border border-white/10 px-4 text-sm text-white">Сохранить роль</button>
              </form>
              <form action={`/api/admin/users/${user.id}/ban`} method="post">
                <input type="hidden" name="isBanned" value={String(!user.isBanned)} />
                <button className="h-11 rounded-xl border border-white/10 px-4 text-sm text-white">
                  {user.isBanned ? "Разбанить" : "Забанить"}
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
