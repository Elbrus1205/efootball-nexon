"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, PencilLine, Save } from "lucide-react";
import { getFaqContentError, normalizeFaqBlocks, type FaqBlock } from "@/lib/faq/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaqBlockEditor } from "@/components/admin/faq-block-editor";
import { FaqBlocks } from "@/components/faq/faq-blocks";
import styles from "@/components/faq/faq.module.css";

export type FaqEditableItem = {
  id: string; title: string; category: string; sortOrder: number; isPublished: boolean; blocks: FaqBlock[];
};
type FaqItemFormProps = {
  action: string; actionName?: "create" | "update"; submitLabel: string; categories?: string[]; item?: FaqEditableItem;
  onCancel?: () => void; onSaved?: () => void;
};

export function FaqItemForm({ action, actionName = "create", submitLabel, categories = [], item, onCancel, onSaved }: FaqItemFormProps) {
  const idBase = useId();
  const router = useRouter();
  const initialBlocks = useRef<FaqBlock[]>(item?.blocks ?? [{ type: "text", text: "" }]);
  const [blocks, setBlocks] = useState(initialBlocks.current);
  const [title, setTitle] = useState(item?.title ?? "");
  const [published, setPublished] = useState(item?.isPublished ?? true);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || uploading) return;
    setSuccess(false);
    const validation = title.trim().length < 3 ? "Вопрос должен быть не короче 3 символов." : getFaqContentError(blocks);
    if (validation) {
      setError(validation);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch(action, { method: "POST", body: data, headers: { Accept: "application/json" } });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
        throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Не удалось сохранить FAQ. Проверьте вход в аккаунт и повторите.");
      }
      setSuccess(true);
      router.refresh();
      onSaved?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить FAQ. Повторите попытку.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setSaving(false);
    }
  };
  return (
    <form action={action} method="post" onSubmit={onSubmit} className={styles.form} aria-busy={saving || uploading}>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="_action" value={actionName} />
      <input type="hidden" name="isPublished" value={String(published)} />
      <fieldset disabled={saving || uploading} className="min-w-0 space-y-5">
        <div className={styles.fields}>
          <div className={`${styles.field} ${styles.titleField}`}>
            <Label htmlFor={`title-${idBase}`}>Вопрос</Label>
            <Input id={`title-${idBase}`} name="title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} placeholder="Как зарегистрироваться на турнир?" />
          </div>
          <div className={styles.field}>
            <Label htmlFor={`category-${idBase}`}>Раздел</Label>
            <Input id={`category-${idBase}`} name="category" defaultValue={item?.category ?? "Общее"} list={`categories-${idBase}`} placeholder="Общее" />
          </div>
          <div className={styles.field}>
            <Label htmlFor={`sort-${idBase}`}>Порядок</Label>
            <Input id={`sort-${idBase}`} name="sortOrder" type="number" min={-2147483648} max={2147483647} defaultValue={item?.sortOrder ?? 0} />
          </div>
        </div>
        <datalist id={`categories-${idBase}`}>{categories.map((category) => <option key={category} value={category} />)}</datalist>
        <div>
          <div className={styles.editorHeading}>
            <h3>Ответ на вопрос</h3>
            <div className={styles.tabs} aria-label="Режим редактора">
              <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}><PencilLine size={14} />Редактор</button>
              <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}><Eye size={14} />Просмотр</button>
            </div>
          </div>
          <div hidden={preview}>
            <FaqBlockEditor name="contentJson" initialBlocks={initialBlocks.current} onChange={setBlocks} onUploadingChange={setUploading} />
          </div>
          {preview ? <div className={styles.preview}>
            <h4>{title || "Новый вопрос"}</h4>
            {normalizeFaqBlocks(blocks).length ? <FaqBlocks blocks={normalizeFaqBlocks(blocks)} /> : <p className={styles.muted}>Добавьте содержание в редакторе — здесь появится готовый ответ.</p>}
          </div> : null}
        </div>
        <div className={styles.footer}>
          <label className={styles.publish}><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />Показывать игрокам</label>
          <div className={styles.formActions}>
            {onCancel ? <Button type="button" variant="secondary" className={styles.secondaryButton} onClick={onCancel}>Отмена</Button> : null}
            <Button type="submit" variant="secondary" className={styles.primaryButton}>{saving || uploading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? "Сохранение…" : uploading ? "Загрузка…" : submitLabel}</Button>
          </div>
        </div>
      </fieldset>
      {error ? <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error}</p> : null}
      {success ? <p role="status" className={styles.success}>FAQ сохранён.</p> : null}
    </form>
  );
}
