import { UserRole } from "@prisma/client";
import { Megaphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminBroadcastsPage({
  searchParams,
}: {
  searchParams?: { sent?: string; failed?: string; error?: string };
}) {
  await requireRole([UserRole.ADMIN]);

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
              Отправьте текст, фото, видео, GIF, аудио или документ всем пользователям, у которых привязан Telegram.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchParams?.error ? (
              <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{searchParams.error}</div>
            ) : null}
            {searchParams?.sent ? (
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Отправлено: {searchParams.sent}. Ошибок: {searchParams.failed ?? 0}.
              </div>
            ) : null}

            <form action="/api/admin/broadcasts" method="post" encType="multipart/form-data" className="space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">Текст</span>
                <Textarea
                  name="text"
                  placeholder="Напишите сообщение. Для медиа оно станет подписью, а длинный текст отправится отдельным сообщением."
                  className="min-h-[180px]"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white">Тип рассылки</span>
                  <select name="mediaType" defaultValue="text" className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <option className="bg-zinc-950" value="text">
                      Только текст
                    </option>
                    <option className="bg-zinc-950" value="photo">
                      Фото
                    </option>
                    <option className="bg-zinc-950" value="video">
                      Видео
                    </option>
                    <option className="bg-zinc-950" value="document">
                      Документ
                    </option>
                    <option className="bg-zinc-950" value="animation">
                      GIF / анимация
                    </option>
                    <option className="bg-zinc-950" value="audio">
                      Аудио
                    </option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white">Ссылка на медиа</span>
                  <Input name="mediaUrl" type="url" placeholder="https://example.com/file.jpg" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">Файл</span>
                <Input
                  name="mediaFile"
                  type="file"
                  accept="image/*,video/*,audio/*,.gif,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                  className="pt-2 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
                />
                <span className="block text-xs text-zinc-500">Для медиа можно прикрепить файл или указать ссылку. Для текстовой рассылки эти поля игнорируются.</span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                <input name="confirm" type="checkbox" className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40" required />
                <span>Подтверждаю отправку всем пользователям с привязанным Telegram.</span>
              </label>

              <Button type="submit" className="w-full gap-2 sm:w-auto">
                <Send className="h-4 w-4" />
                Отправить рассылку
              </Button>
            </form>
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
                } | null;

                return (
                  <div key={broadcast.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="font-medium text-white">
                        {data?.mediaType ?? "text"}: отправлено {data?.sent ?? 0} из {data?.recipients ?? 0}
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
