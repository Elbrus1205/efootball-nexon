"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Loader2, PencilLine, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { faqCategoryNameSchema, getFaqCategoryRenameError } from "@/lib/faq/category-order";
import styles from "@/components/faq/faq.module.css";

export function FaqCategoryOrder({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [order, setOrder] = useState(categories);
  const [savedOrder, setSavedOrder] = useState(categories);
  const [names, setNames] = useState<Map<string, string>>(() => new Map());
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const renamed = order.some((name) => (names.get(name) ?? name) !== name);
  const changed = renamed || order.some((name, index) => name !== savedOrder[index]);
  const changes = order.map((originalName) => ({ originalName, name: names.get(originalName) ?? originalName }));
  const applyName = () => {
    if (editing === null) return;
    const result = faqCategoryNameSchema.safeParse(draftName);
    if (!result.success) { setEditError(result.error.issues[0].message); return; }
    const next = changes.map((row) => row.originalName === editing ? { ...row, name: result.data } : row);
    const conflict = getFaqCategoryRenameError(next);
    if (conflict) { setEditError(conflict); return; }
    setNames(new Map(names).set(editing, result.data));
    setEditing(null);
    setEditError("");
    setMessage("");
    setError("");
  };
  const move = (index: number, direction: number) => {
    const next = [...order];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setOrder(next);
    setMessage("");
    setError("");
  };
  const save = async () => {
    if (saving || !changed || editing !== null) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/faq/categories", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(renamed ? changes : order),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
        throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Не удалось сохранить порядок разделов. Повторите попытку.");
      }
      const nextOrder = changes.map((row) => row.name);
      setOrder(nextOrder);
      setSavedOrder(nextOrder);
      setNames(new Map());
      setMessage(renamed ? "Названия и порядок разделов сохранены." : "Порядок разделов сохранён.");
      if (renamed) router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить порядок разделов.");
    } finally { setSaving(false); }
  };

  return (
    <section className={styles.categoryOrder} aria-labelledby="faq-category-order-title" aria-busy={saving}>
      <h3 id="faq-category-order-title">Порядок разделов FAQ</h3>
      <p className={styles.categoryOrderHint}>Перемещайте разделы выше или ниже. Карандаш меняет название у всех вопросов раздела. После изменений нажмите «Сохранить».</p>
      {order.length ? <ol className={styles.categoryOrderList}>
        {order.map((name, index) => <li key={name}>
          <span className={styles.categoryPosition}>{index + 1}</span>
          <span className={styles.categoryName}>{names.get(name) ?? name}</span>
          <div className={styles.categoryActions}>
            <Button type="button" variant="ghost" className={styles.iconButton} disabled={saving || editing !== null} aria-label={`Переименовать раздел «${names.get(name) ?? name}»`} title="Переименовать раздел" onClick={() => { setEditing(name); setDraftName(names.get(name) ?? name); setEditError(""); }}><PencilLine size={16} /></Button>
            <Button type="button" variant="ghost" className={styles.iconButton} disabled={saving || editing !== null || index === 0} aria-label={`Раздел «${names.get(name) ?? name}» выше`} title="Выше" onClick={() => move(index, -1)}><ArrowUp size={16} /></Button>
            <Button type="button" variant="ghost" className={styles.iconButton} disabled={saving || editing !== null || index === order.length - 1} aria-label={`Раздел «${names.get(name) ?? name}» ниже`} title="Ниже" onClick={() => move(index, 1)}><ArrowDown size={16} /></Button>
          </div>
          {editing === name ? <form className={styles.categoryRename} onSubmit={(event) => { event.preventDefault(); applyName(); }}>
            <label htmlFor="faq-category-name">Название раздела</label>
            <div className={styles.categoryRenameFields}>
              <Input id="faq-category-name" autoFocus value={draftName} maxLength={100} onChange={(event) => { setDraftName(event.target.value); setEditError(""); }} onKeyDown={(event) => { if (event.key === "Escape") setEditing(null); }} aria-invalid={Boolean(editError)} aria-describedby={editError ? "faq-category-name-error" : undefined} />
              <Button type="submit" variant="ghost" className={styles.iconButton} aria-label="Применить название" title="Применить название"><Check size={16} /></Button>
              <Button type="button" variant="ghost" className={styles.iconButton} aria-label="Отменить переименование" title="Отмена" onClick={() => setEditing(null)}><X size={16} /></Button>
            </div>
            {editError ? <p id="faq-category-name-error" role="alert" className={styles.error}>{editError}</p> : null}
          </form> : null}
        </li>)}
      </ol> : <p className={styles.categoryOrderHint}>Разделы появятся после добавления вопросов.</p>}
      {order.length ? <div className={styles.categoryOrderFooter}>
        <Button type="button" variant="secondary" className={styles.primaryButton} disabled={saving || !changed || editing !== null} onClick={() => void save()}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? "Сохранение…" : renamed ? "Сохранить изменения" : "Сохранить порядок"}
        </Button>
        {changed && !saving ? <span className={styles.categoryOrderHint}>Есть несохранённые изменения</span> : null}
      </div> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {message ? <p role="status" className={styles.success}>{message}</p> : null}
    </section>
  );
}
