import Link from "next/link";
import { Prisma } from "@prisma/client";
import { HelpCircle, Search } from "lucide-react";
import { FaqManager } from "@/components/admin/faq-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveFaqBlocks } from "@/lib/faq/content";
import styles from "@/components/faq/faq.module.css";

const PAGE_SIZE = 12;
type SearchParams = { q?: string; status?: string; page?: string; created?: string; updated?: string; deleted?: string; error?: string };

export default async function AdminFaqPage(props: { searchParams?: Promise<SearchParams> }) {
  await requirePermission("content.manage");
  const params = await props.searchParams ?? {};
  const query = params.q?.trim().slice(0, 200) ?? "";
  const status = ["published", "draft"].includes(params.status ?? "") ? params.status : "";
  const where: Prisma.FaqItemWhereInput = {
    ...(query ? { OR: ["title", "answer", "category"].map((field) => ({ [field]: { contains: query, mode: Prisma.QueryMode.insensitive } })) } : {}),
    ...(status ? { isPublished: status === "published" } : {}),
  };
  const [total, publishedCount, filteredCount, categoryRows] = await Promise.all([
    db.faqItem.count(),
    db.faqItem.count({ where: { isPublished: true } }),
    db.faqItem.count({ where }),
    db.faqItem.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const requestedPage = Number(params.page);
  const page = Math.min(pageCount, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const items = await db.faqItem.findMany({
    where,
    select: {
      id: true, title: true, answer: true, contentJson: true, category: true, sortOrder: true, isPublished: true,
      attachments: { select: { title: true, url: true, kind: true, mimeType: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
  });
  const categories = categoryRows.map((row) => row.category).filter(Boolean);
  const pageUrl = (next: number) => {
    const search = new URLSearchParams({ page: String(next) });
    if (query) search.set("q", query);
    if (status) search.set("status", status);
    return `/admin/faq?${search}`;
  };
  return (
    <div className={styles.scope}>
      <header className={styles.adminHeader}>
        <div>
          <p className={styles.eyebrow}><HelpCircle size={14} aria-hidden="true" />Центр помощи</p>
          <h2 className="mt-2">Управление FAQ</h2>
          <p className={`${styles.muted} mt-2`}>Понятные ответы для игроков. Текст, фото и видео в одной инструкции.</p>
          <div className={styles.stats}><span><strong>{total}</strong> всего</span><span><strong>{publishedCount}</strong> опубликовано</span><span><strong>{total - publishedCount}</strong> в черновиках</span></div>
        </div>
      </header>
      {params.created || params.updated || params.deleted ? <p role="status" className={`${styles.success} mt-3`}>Изменения FAQ сохранены.</p> : null}
      {params.error ? <p role="alert" className={`${styles.error} mt-3`}>{params.error}</p> : null}
      <form action="/admin/faq" method="get" className={styles.toolbar}>
        <Input name="q" type="search" defaultValue={query} placeholder="Найти вопрос, ответ или раздел" aria-label="Поиск вопросов в админке" />
        <select name="status" defaultValue={status} className={styles.select} aria-label="Статус публикации"><option value="">Все статусы</option><option value="published">Опубликованные</option><option value="draft">Черновики</option></select>
        <Button variant="secondary" className={styles.secondaryButton}><Search size={15} aria-hidden="true" />Найти</Button>
      </form>
      <FaqManager key={`${page}-${query}-${status}`} categories={categories} items={items.map((item) => ({
        id: item.id, title: item.title, category: item.category, sortOrder: item.sortOrder, isPublished: item.isPublished, blocks: resolveFaqBlocks(item),
      }))} />
      <nav className={styles.pagination} aria-label="Страницы FAQ">
        <span>{filteredCount ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredCount)} из ${filteredCount}` : "Найдено: 0"}</span>
        <div className="flex items-center gap-2">
          {page > 1 ? <Link href={pageUrl(page - 1)}>Назад</Link> : null}
          <span>{page} / {pageCount}</span>
          {page < pageCount ? <Link href={pageUrl(page + 1)}>Далее</Link> : null}
        </div>
      </nav>
    </div>
  );
}
