"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { AlignLeft, ArrowDown, ArrowUp, ChevronDown, FileUp, Heading, ImagePlus, Info, Link2, Paperclip, PlayCircle, Trash2 } from "lucide-react";
import { type FaqBlock, type FaqBlockType, isMediaBlock, isTextBlock } from "@/lib/faq/content";
import { FAQ_IMAGE_MIME_TYPES, FAQ_VIDEO_MIME_TYPES, FAQ_UPLOAD_MIME_TYPES } from "@/lib/faq/media";
import { FaqBlocks } from "@/components/faq/faq-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile } from "@/lib/storage/upload-client";
import styles from "@/components/faq/faq.module.css";

const palette = [
  { type: "text", label: "Текст", icon: AlignLeft },
  { type: "heading", label: "Заголовок", icon: Heading },
  { type: "note", label: "Заметка", icon: Info },
  { type: "image", label: "Фото", icon: ImagePlus },
  { type: "video", label: "Видео", icon: PlayCircle },
  { type: "file", label: "Файл", icon: Paperclip },
  { type: "link", label: "Ссылка", icon: Link2 },
] satisfies { type: FaqBlockType; label: string; icon: typeof AlignLeft }[];

function createBlock(type: FaqBlockType): FaqBlock {
  if (type === "heading" || type === "text" || type === "note") return { type, text: "" };
  if (type === "image" || type === "video") return { type, url: "", caption: "" };
  return { type, url: "", title: "" };
}

export function FaqBlockEditor({ name, initialBlocks, onChange, onUploadingChange }: {
  name: string;
  initialBlocks: FaqBlock[];
  onChange: (blocks: FaqBlock[]) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const groupId = useId();
  const sequence = useRef(initialBlocks.length);
  const [entries, setEntries] = useState(() => initialBlocks.map((block, index) => ({ id: String(index), block })));
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const entriesRef = useRef(entries);

  const commit = (next: typeof entries) => {
    entriesRef.current = next;
    setEntries(next);
    onChange(next.map((entry) => entry.block));
  };
  const updateBlock = (id: string, block: FaqBlock) => commit(entriesRef.current.map((entry) => entry.id === id ? { ...entry, block } : entry));
  const addBlock = (type: FaqBlockType) => {
    const id = String(sequence.current++);
    commit([...entriesRef.current, { id, block: createBlock(type) }]);
    requestAnimationFrame(() => document.getElementById(`${groupId}-${id}`)?.querySelector<HTMLElement>("textarea, input:not([type=hidden])")?.focus());
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    const next = [...entriesRef.current];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(entries.map((entry) => entry.block))} />
      {entries.map(({ id, block }, index) => {
        const entry = palette.find((candidate) => candidate.type === block.type)!;
        const closed = collapsed.includes(id);
        const panelId = `${groupId}-${id}`;
        return (
          <div key={id} className={styles.block}>
            <div className={styles.blockHeader}>
              <button type="button" className={styles.blockToggle} aria-expanded={!closed} aria-controls={panelId} onClick={() => setCollapsed((current) => closed ? current.filter((key) => key !== id) : [...current, id])}>
                <entry.icon size={15} aria-hidden="true" /><span>{entry.label}</span><span className={styles.blockIndex}>{String(index + 1).padStart(2, "0")}</span><ChevronDown size={13} className={closed ? "-rotate-90" : ""} aria-hidden="true" />
              </button>
              <div className={styles.blockActions}>
                <BlockIconButton label="Выше" onClick={() => moveBlock(index, -1)} disabled={index === 0}><ArrowUp size={15} /></BlockIconButton>
                <BlockIconButton label="Ниже" onClick={() => moveBlock(index, 1)} disabled={index === entries.length - 1}><ArrowDown size={15} /></BlockIconButton>
                <BlockIconButton label="Удалить блок" onClick={() => {
                  const hasContent = isTextBlock(block) ? block.text.trim() : block.url.trim();
                  if (hasContent && !window.confirm("Удалить этот блок из ответа?")) return;
                  commit(entriesRef.current.filter((candidate) => candidate.id !== id));
                }}><Trash2 size={15} /></BlockIconButton>
              </div>
            </div>
            <div id={panelId} hidden={closed} className={styles.blockBody}>
              <BlockFields block={block} onChange={(next) => updateBlock(id, next)} onUploadingChange={onUploadingChange} />
            </div>
          </div>
        );
      })}
      {!entries.length ? <p className={styles.muted}>Добавьте текст, фото или видео с помощью кнопок ниже.</p> : null}
      <div className={styles.palette} aria-label="Добавить блок">
        {palette.map((entry) => <button key={entry.type} type="button" onClick={() => addBlock(entry.type)}><entry.icon aria-hidden="true" />{entry.label}</button>)}
      </div>
    </div>
  );
}

function BlockIconButton({ label, onClick, disabled, children }: {
  label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={styles.iconButton}>{children}</button>;
}

function BlockFields({ block, onChange, onUploadingChange }: {
  block: FaqBlock; onChange: (block: FaqBlock) => void; onUploadingChange: (uploading: boolean) => void;
}) {
  const fieldId = useId();
  if (isTextBlock(block)) return (
    <div className={styles.field}>
      <Label htmlFor={fieldId}>{block.type === "heading" ? "Текст подзаголовка" : block.type === "note" ? "Текст заметки" : "Текст ответа"}</Label>
      {block.type === "heading" ? <Input id={fieldId} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} placeholder="Название раздела ответа" /> : (
        <Textarea id={fieldId} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} rows={3} placeholder={block.type === "note" ? "Важная деталь или полезный совет" : "Напишите ответ. Можно разделить его на абзацы."} />
      )}
    </div>
  );
  return <MediaFields block={block} fieldId={fieldId} onChange={onChange} onUploadingChange={onUploadingChange} />;
}

function MediaFields({ block, fieldId, onChange, onUploadingChange }: {
  block: Exclude<FaqBlock, { type: "heading" | "text" | "note" }>;
  fieldId: string; onChange: (block: FaqBlock) => void; onUploadingChange: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const media = isMediaBlock(block);
  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    onUploadingChange(true);
    setError("");
    try {
      const url = await uploadFile(file, "faq");
      onChange({ ...block, url, mimeType: file.type, ...(block.type === "file" && !block.title.trim() ? { title: file.name } : {}) });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить файл.");
    } finally {
      setUploading(false);
      onUploadingChange(false);
      input.value = "";
    }
  };
  return (
    <div className="space-y-3">
      <div className={styles.upload}>
        <div className={styles.field}>
          <Label htmlFor={fieldId}>{block.type === "image" ? "Ссылка на фото" : block.type === "video" ? "Ссылка на видео" : "Ссылка"}</Label>
          <Input id={fieldId} value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder={block.type === "video" ? "YouTube, RuTube или видеофайл" : "https://…"} inputMode="url" />
        </div>
        {block.type !== "link" ? <>
          <input ref={inputRef} type="file" accept={(block.type === "image" ? FAQ_IMAGE_MIME_TYPES : block.type === "video" ? FAQ_VIDEO_MIME_TYPES : FAQ_UPLOAD_MIME_TYPES).join(",")} className="hidden" onChange={onFileChange} aria-label="Выбрать файл" />
          <Button type="button" variant="secondary" className={styles.secondaryButton} disabled={uploading} onClick={() => inputRef.current?.click()}><FileUp size={15} />{uploading ? "Загрузка…" : "Загрузить"}</Button>
        </> : null}
      </div>
      {block.type !== "link" ? <p className="text-xs text-zinc-400">Файл до 16 МБ.{block.type === "video" ? " Для длинного ролика вставьте ссылку YouTube или RuTube." : ""}</p> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <div className={styles.field}>
        <Label htmlFor={`${fieldId}-caption`}>{media ? "Подпись снизу (необязательно)" : "Название ссылки или файла"}</Label>
        <Input id={`${fieldId}-caption`} value={isMediaBlock(block) ? block.caption ?? "" : block.title} onChange={(event) => onChange(isMediaBlock(block) ? { ...block, caption: event.target.value } : { ...block, title: event.target.value })} placeholder={media ? "Что показано на фото или видео" : "Например: Регламент турнира"} />
      </div>
      {media && block.url ? <div className={styles.mediaPreview}><FaqBlocks blocks={[block]} /></div> : null}
    </div>
  );
}
