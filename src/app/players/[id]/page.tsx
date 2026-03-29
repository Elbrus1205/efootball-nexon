import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { formatDate } from "@/lib/utils";

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const user = await db.user.findUnique({
    where: { id: params.id },
  });

  if (!user) notFound();

  return (
    <div className="page-shell space-y-8">
      <Card className="p-6">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-thin text-white">{getPlayerDisplayName(user)}</h1>
          <div className="grid gap-3 text-sm text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
            <div>Имя: {user.name ?? "Не указано"}</div>
            <div>UID: {user.efootballUid ?? "Не указан"}</div>
            <div>Telegram: {user.telegramUsername ? `@${user.telegramUsername}` : "Не привязан"}</div>
            <div>На платформе: {formatDate(user.createdAt, "d MMM yyyy")}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
