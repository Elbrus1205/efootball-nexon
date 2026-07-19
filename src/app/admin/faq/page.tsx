import { CheckCircle2, CircleDashed, HelpCircle, Layers, Plus } from "lucide-react";
import { FaqItemForm } from "@/components/admin/faq-item-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { blocksToPlainText, resolveFaqBlocks } from "@/lib/faq/content";

export default async function AdminFaqPage(props: {
  searchParams?: Promise<{ created?: string; updated?: string; deleted?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  await requirePermission("content.manage");

  const items = await db.faqItem.findMany({
    include: { attachments: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );

  const publishedCount = items.filter((item) => item.isPublished).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-r from-primary/[0.08] via-transparent to-transparent p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            <HelpCircle className="h-3.5 w-3.5" />
            FAQ
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white">Управление FAQ</h2>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            Собирайте ответы из блоков — текст, фото и видео с подписями, файлы и ссылки. Опубликованные записи сразу
            появляются на публичной странице с поиском.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:w-[300px]">
          <Stat icon={Layers} label="Всего" value={items.length} />
          <Stat icon={CheckCircle2} label="Активно" value={publishedCount} />
          <Stat icon={CircleDashed} label="Разделов" value={categories.length} />
        </div>
      </div>

      {searchParams?.created ? <Banner tone="ok">FAQ добавлен.</Banner> : null}
      {searchParams?.updated ? <Banner tone="ok">FAQ обновлён.</Banner> : null}
      {searchParams?.deleted ? <Banner tone="ok">FAQ удалён.</Banner> : null}
      {searchParams?.error ? <Banner tone="error">{searchParams.error}</Banner> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Новый вопрос
          </CardTitle>
          <CardDescription>Добавьте вопрос, соберите ответ из блоков и опубликуйте.</CardDescription>
        </CardHeader>
        <FaqItemForm action="/api/admin/faq" submitLabel="Добавить FAQ" categories={categories} />
      </Card>

      <div className="grid gap-4">
        {items.map((item) => {
          const blocks = resolveFaqBlocks(item);
          const preview = blocksToPlainText(blocks).slice(0, 140);

          return (
            <Card key={item.id} className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                      {item.category}
                    </span>
                    <span
                      className={
                        item.isPublished
                          ? "rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200"
                          : "rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400"
                      }
                    >
                      {item.isPublished ? "Опубликовано" : "Черновик"}
                    </span>
                    <span className="text-xs text-zinc-500">порядок {item.sortOrder} · блоков {blocks.length}</span>
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">{item.title}</div>
                  {preview ? <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{preview}</p> : null}
                </div>
                <form action="/api/admin/faq" method="post">
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={item.id} />
                  <Button variant="outline" className="border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 hover:text-white">
                    Удалить
                  </Button>
                </form>
              </div>

              <details className="group">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-primary">
                  Редактировать
                  <span className="text-xs text-zinc-500 transition group-open:hidden">▼</span>
                  <span className="hidden text-xs text-zinc-500 group-open:inline">▲</span>
                </summary>
                <div className="mt-4">
                  <FaqItemForm
                    action="/api/admin/faq"
                    actionName="update"
                    submitLabel="Сохранить"
                    categories={categories}
                    item={{
                      id: item.id,
                      title: item.title,
                      category: item.category,
                      sortOrder: item.sortOrder,
                      isPublished: item.isPublished,
                      blocks,
                    }}
                  />
                </div>
              </details>
            </Card>
          );
        })}

        {!items.length ? <Card className="p-6 text-sm text-zinc-500">FAQ пока пустой.</Card> : null}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  return (
    <Card
      className={
        tone === "ok"
          ? "border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-100"
          : "border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100"
      }
    >
      {children}
    </Card>
  );
}
