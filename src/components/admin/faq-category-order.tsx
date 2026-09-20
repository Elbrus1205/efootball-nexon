"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/faq/faq.module.css";

export function FaqCategoryOrder({ categories }: { categories: string[] }) {
  const [order, setOrder] = useState(categories);
  const [savedOrder, setSavedOrder] = useState(categories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const changed = order.some((name, index) => name !== savedOrder[index]);
  const move = (index: number, direction: number) => {
    const next = [...order];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setOrder(next);
    setMessage("");
    setError("");
  };
  const save = async () => {
    if (saving || !changed) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/faq/categories", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
        throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Не удалось сохранить порядок разделов. Повторите попытку.");
      }
      setSavedOrder(order);
      setMessage("Порядок разделов сохранён.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить порядок разделов.");
    } finally { setSaving(false); }
  };

  return (
    <section className={styles.categoryOrder} aria-labelledby="faq-category-order-title" aria-busy={saving}>
      <h3 id="faq-category-order-title">Порядок разделов FAQ</h3>
      <p className={styles.categoryOrderHint}>Перемещайте разделы выше или ниже. Так они будут расположены на странице FAQ и в меню разделов.</p>
      {order.length ? <ol className={styles.categoryOrderList}>
        {order.map((name, index) => <li key={name}>
          <span className={styles.categoryPosition}>{index + 1}</span>
          <span className={styles.categoryName}>{name}</span>
          <div className={styles.categoryActions}>
            <Button type="button" variant="ghost" className={styles.iconButton} disabled={saving || index === 0} aria-label={`Раздел «${name}» выше`} title="Выше" onClick={() => move(index, -1)}><ArrowUp size={16} /></Button>
            <Button type="button" variant="ghost" className={styles.iconButton} disabled={saving || index === order.length - 1} aria-label={`Раздел «${name}» ниже`} title="Ниже" onClick={() => move(index, 1)}><ArrowDown size={16} /></Button>
          </div>
        </li>)}
      </ol> : <p className={styles.categoryOrderHint}>Разделы появятся после добавления вопросов.</p>}
      {order.length > 1 ? <div className={styles.categoryOrderFooter}>
        <Button type="button" variant="secondary" className={styles.primaryButton} disabled={saving || !changed} onClick={() => void save()}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? "Сохранение…" : "Сохранить порядок"}
        </Button>
        {changed && !saving ? <span className={styles.categoryOrderHint}>Есть несохранённые изменения</span> : null}
      </div> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {message ? <p role="status" className={styles.success}>{message}</p> : null}
    </section>
  );
}
