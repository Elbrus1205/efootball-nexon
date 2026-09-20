"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, FileQuestion, Loader2, PencilLine, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FaqItemForm, type FaqEditableItem } from "./faq-item-form";
import { blocksToPlainText } from "@/lib/faq/content";
import styles from "@/components/faq/faq.module.css";

export function FaqManager({ items, categories }: { items: FaqEditableItem[]; categories: string[] }) {
  const router = useRouter();
  const [editor, setEditor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const cancel = () => {
    if (window.confirm("Закрыть редактор? Несохранённые изменения будут потеряны.")) setEditor(null);
  };
  const saved = () => { setEditor(null); setMessage("FAQ сохранён. Изменения применены."); setError(""); };
  const remove = async (item: FaqEditableItem) => {
    if (!window.confirm(`Удалить вопрос «${item.title}»? Это действие нельзя отменить.`)) return;
    setDeleting(item.id);
    setError("");
    setMessage("");
    const body = new FormData();
    body.set("_action", "delete");
    body.set("id", item.id);
    try {
      const response = await fetch("/api/admin/faq", { method: "POST", body, headers: { Accept: "application/json" } });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== true) {
        throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Не удалось удалить вопрос. Повторите попытку.");
      }
      setMessage("Вопрос удалён.");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить вопрос.");
    } finally { setDeleting(null); }
  };
  return (
    <div className={styles.scope}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" className={styles.primaryButton} disabled={editor !== null || deleting !== null} onClick={() => { setEditor("new"); setMessage(""); }}><Plus size={16} />Добавить вопрос</Button>
        <Link href="/faq" target="_blank" className={styles.heroLink}>Открыть FAQ <ArrowUpRight size={14} /></Link>
      </div>
      {message ? <p role="status" className={`${styles.success} mt-3`}>{message}</p> : null}
      {error ? <p role="alert" className={`${styles.error} mt-3`}>{error}</p> : null}
      {editor === "new" ? (
        <section className={styles.createPanel} aria-label="Новый вопрос">
          <h3 className={styles.panelHeading}>Новый вопрос</h3>
          <div className={styles.editorPanel}><FaqItemForm action="/api/admin/faq" submitLabel="Сохранить" categories={categories} onCancel={cancel} onSaved={saved} /></div>
        </section>
      ) : null}
      <div className={`${styles.list} mt-4`}>
        {items.map((item) => (
          <article key={item.id} className={styles.listItem}>
            <div className={styles.listRow}>
              <div className={styles.rowText}>
                <div className={styles.meta}><span className={item.isPublished ? styles.published : undefined}>{item.isPublished ? "Опубликован" : "Черновик"}</span><span>·</span><span>{item.category}</span></div>
                <h3>{item.title}</h3>
                <p className="line-clamp-1">{blocksToPlainText(item.blocks) || "Ответ с медиафайлами"}</p>
                <p>Блоков: {item.blocks.length} · Порядок в разделе: {item.sortOrder}</p>
              </div>
              <div className={styles.rowActions}>
                <Button type="button" variant="ghost" className={styles.iconButton} title="Редактировать" aria-label={`Редактировать: ${item.title}`} aria-expanded={editor === item.id} aria-controls={`faq-editor-${item.id}`} disabled={editor !== null || deleting !== null} onClick={() => { setEditor(item.id); setMessage(""); }}><PencilLine size={16} /></Button>
                <Button type="button" variant="ghost" className={styles.iconButton} title="Удалить вопрос" aria-label={`Удалить: ${item.title}`} disabled={editor !== null || deleting !== null} onClick={() => void remove(item)}>{deleting === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</Button>
              </div>
            </div>
            {editor === item.id ? <div id={`faq-editor-${item.id}`} className={styles.editorPanel}><FaqItemForm action="/api/admin/faq" actionName="update" submitLabel="Сохранить" categories={categories} item={item} onCancel={cancel} onSaved={saved} /></div> : null}
          </article>
        ))}
        {!items.length ? <div className={styles.empty}><FileQuestion size={24} /><strong>Вопросов пока нет</strong><p>Добавьте вопрос или измените условия поиска.</p></div> : null}
      </div>
    </div>
  );
}
