import { FaqItemForm } from "@/components/admin/faq-item-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminFaqPage({
  searchParams,
}: {
  searchParams?: { created?: string; updated?: string; deleted?: string; error?: string };
}) {
  await requirePermission("content.manage");

  const items = await db.faqItem.findMany({
    include: { attachments: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-thin text-white">FAQ</h2>
        <p className="max-w-2xl text-sm text-zinc-400">
          Добавляйте вопросы, ответы и вложения. Опубликованные записи сразу появляются на публичной странице FAQ.
        </p>
      </div>

      {searchParams?.created ? <Card className="border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">FAQ добавлен.</Card> : null}
      {searchParams?.updated ? <Card className="border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">FAQ обновлён.</Card> : null}
      {searchParams?.deleted ? <Card className="border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">FAQ удалён.</Card> : null}
      {searchParams?.error ? <Card className="border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">{searchParams.error}</Card> : null}

      <Card>
        <CardHeader>
          <CardTitle>Новый вопрос</CardTitle>
          <CardDescription>Можно прикрепить фото, видео, файл или внешнюю ссылку.</CardDescription>
        </CardHeader>
        <FaqItemForm action="/api/admin/faq" submitLabel="Добавить FAQ" />
      </Card>

      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id} className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{item.category}</div>
                <div className="mt-1 text-lg font-semibold text-white">{item.title}</div>
                <div className="mt-1 text-sm text-zinc-500">{item.isPublished ? "Опубликовано" : "Черновик"} · порядок {item.sortOrder}</div>
              </div>
              <form action="/api/admin/faq" method="post">
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={item.id} />
                <Button variant="outline" className="border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                  Удалить
                </Button>
              </form>
            </div>

            <FaqItemForm
              action="/api/admin/faq"
              actionName="update"
              submitLabel="Сохранить"
              item={{
                id: item.id,
                title: item.title,
                answer: item.answer,
                category: item.category,
                sortOrder: item.sortOrder,
                isPublished: item.isPublished,
                attachments: item.attachments.map((attachment) => ({
                  title: attachment.title,
                  url: attachment.url,
                  kind: attachment.kind,
                  mimeType: attachment.mimeType ?? undefined,
                })),
              }}
            />
          </Card>
        ))}

        {!items.length ? <Card className="p-6 text-sm text-zinc-500">FAQ пока пустой.</Card> : null}
      </div>
    </div>
  );
}
