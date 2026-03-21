import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminTournamentsPage() {
  await requireRole([UserRole.ADMIN]);
  const tournaments = await db.tournament.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="page-shell space-y-6">
      <h1 className="font-display text-3xl font-semibold text-white">Управление турнирами</h1>
      <form action="/api/admin/tournaments" method="post" className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-2">
        <input name="title" placeholder="Название" className="h-11 rounded-xl bg-black/30 px-4 text-white" />
        <input name="prizePool" placeholder="Призовой фонд" className="h-11 rounded-xl bg-black/30 px-4 text-white" />
        <textarea name="description" placeholder="Описание" className="min-h-28 rounded-xl bg-black/30 px-4 py-3 text-white md:col-span-2" />
        <textarea name="rules" placeholder="Правила" className="min-h-28 rounded-xl bg-black/30 px-4 py-3 text-white md:col-span-2" />
        <input name="startsAt" type="datetime-local" className="h-11 rounded-xl bg-black/30 px-4 text-white" />
        <input name="registrationEndsAt" type="datetime-local" className="h-11 rounded-xl bg-black/30 px-4 text-white" />
        <input name="maxParticipants" type="number" placeholder="Макс. участников" className="h-11 rounded-xl bg-black/30 px-4 text-white" />
        <select name="format" className="h-11 rounded-xl bg-black/30 px-4 text-white">
          <option value="SINGLE_ELIMINATION">Single Elimination</option>
          <option value="DOUBLE_ELIMINATION">Double Elimination</option>
          <option value="ROUND_ROBIN">Round Robin</option>
        </select>
        <Button className="md:col-span-2">Создать турнир</Button>
      </form>

      <div className="grid gap-4">
        {tournaments.map((tournament) => (
          <Card key={tournament.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium text-white">{tournament.title}</div>
              <div className="text-sm text-zinc-500">{tournament.status}</div>
            </div>
            <div className="flex gap-2">
              <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                <input type="hidden" name="_method" value="close" />
                <Button variant="secondary">Закрыть регистрацию</Button>
              </form>
              <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                <input type="hidden" name="_method" value="delete" />
                <Button variant="outline">Удалить</Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
