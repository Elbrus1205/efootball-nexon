import { UserRole } from "@prisma/client";
import { Megaphone } from "lucide-react";
import { TelegramBroadcastForm } from "@/components/admin/telegram-broadcast-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminBroadcastsPage({
  searchParams,
}: {
  searchParams?: { sent?: string; failed?: string; error?: string };
}) {
  await requireRole([UserRole.FOUNDER]);

  const [telegramRecipients, totalUsers, latestBroadcasts] = await db.$transaction([
    db.user.count({ where: { telegramId: { not: null } } }),
    db.user.count(),
    db.adminAction.findMany({
      where: { entityType: "TELEGRAM_BROADCAST" },
      include: { admin: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Рассылки в Telegram
            </CardTitle>
            <CardDescription>
              Отправьте текст, фото, видео, GIF, аудио или документ всем пользователям, у которых привязан Telegram. Поддерживаются Telegram HTML и inline-кнопки.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelegramBroadcastForm error={searchParams?.error} sent={searchParams?.sent} failed={searchParams?.failed} />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Получатели</CardTitle>
            <CardDescription>Сейчас рассылку получат только аккаунты с Telegram ID.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-white">{telegramRecipients}</div>
            <div className="text-sm text-zinc-500">из {totalUsers} пользователей</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Последние рассылки</CardTitle>
          <CardDescription>Краткий журнал отправок через админ-панель.</CardDescription>
        </CardHeader>
        <CardContent>
          {latestBroadcasts.length ? (
            <div className="divide-y divide-white/10">
              {latestBroadcasts.map((broadcast) => {
                const data = broadcast.afterJson as {
                  mediaType?: string;
                  recipients?: number;
                  sent?: number;
                  failed?: number;
                  useHtml?: boolean;
                  buttonsCount?: number;
                } | null;

                return (
                  <div key={broadcast.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="font-medium text-white">
                        {data?.mediaType ?? "text"}: отправлено {data?.sent ?? 0} из {data?.recipients ?? 0}
                        {data?.useHtml ? <span className="ml-2 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-300">HTML</span> : null}
                        {data?.buttonsCount ? <span className="ml-2 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-300">Кнопок: {data.buttonsCount}</span> : null}
                      </div>
                      <div className="text-zinc-500">
                        {broadcast.admin.nickname ?? broadcast.admin.name ?? broadcast.admin.email ?? "Администратор"}
                      </div>
                    </div>
                    <div className="text-zinc-500">
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(broadcast.createdAt)}
                      {data?.failed ? <span className="ml-2 text-amber-200">Ошибок: {data.failed}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">Рассылок пока не было.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
