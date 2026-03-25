import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const user = await db.user.findUnique({
    where: { id: params.id },
    include: {
      tournamentEntries: {
        include: { tournament: true },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });

  if (!user) notFound();

  return (
    <div className="page-shell space-y-8">
      <Card className="p-6">
        <div className="space-y-3">
          <div className="text-sm uppercase tracking-[0.22em] text-zinc-500">Профиль игрока</div>
          <h1 className="font-display text-3xl font-thin text-white">{user.nickname ?? user.name ?? "Игрок eFootball Nexon"}</h1>
          <div className="grid gap-3 text-sm text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
            <div>Имя: {user.name ?? "Не указано"}</div>
            <div>UID: {user.efootballUid ?? "Не указан"}</div>
            <div>Telegram: {user.telegramUsername ? `@${user.telegramUsername}` : "Не привязан"}</div>
            <div>На платформе: {formatDate(user.createdAt, "d MMM yyyy")}</div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 text-lg font-medium text-white">Последние турниры</div>
        {user.tournamentEntries.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {user.tournamentEntries.map((entry) => (
              <Card key={entry.id} className="border-white/10 bg-white/[0.02] p-4">
                <div className="font-medium text-white">{entry.tournament.title}</div>
                <div className="mt-2 text-sm text-zinc-400">{entry.clubName ?? "Клуб не назначен"}</div>
                <div className="mt-1 text-xs text-zinc-500">Статус участия: {entry.status}</div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-zinc-500">У этого игрока пока нет завершённых или активных участий в турнирах.</div>
        )}
      </Card>
    </div>
  );
}
