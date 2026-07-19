"use client";

import { useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  FileUp,
  Heading,
  ImagePlus,
  Info,
  Link2,
  Paperclip,
  PlayCircle,
  Trash2,
} from "lucide-react";
import type { FaqBlock, FaqBlockType } from "@/lib/faq/content";
import { isAttachmentBlock, isMediaBlock, isTextBlock } from "@/lib/faq/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile } from "@/lib/storage/upload-client";
import { cn } from "@/lib/utils";

type BlockPaletteEntry = {
  type: FaqBlockType;
  label: string;
  hint: string;
  icon: typeof AlignLeft;
};

const TEXT_PALETTE: BlockPaletteEntry[] = [
  { type: "text", label: "Абзац", hint: "Обычный текст ответа", icon: AlignLeft },
  { type: "heading", label: "Подзаголовок", hint: "Разделяет длинный ответ", icon: Heading },
  { type: "note", label: "Заметка", hint: "Выделенный совет или предупреждение", icon: Info },
];

const MEDIA_PALETTE: BlockPaletteEntry[] = [
  { type: "image", label: "Фото", hint: "Изображение с подписью снизу", icon: ImagePlus },
  { type: "video", label: "Видео", hint: "Ролик с подписью снизу", icon: PlayCircle },
];

const ATTACHMENT_PALETTE: BlockPaletteEntry[] = [
  { type: "file", label: "Файл", hint: "Документ для скачивания", icon: Paperclip },
  { type: "link", label: "Ссылка", hint: "Внешняя ссылка", icon: Link2 },
];

function createBlock(type: FaqBlockType): FaqBlock {
  if (type === "heading" || type === "text" || type === "note") return { type, text: "" };
  if (type === "image" || type === "video") return { type, url: "", caption: "" };
  return { type, url: "", title: "" };
}

const blockAccent: Record<FaqBlockType, string> = {
  heading: "border-primary/25 bg-primary/[0.06]",
  text: "border-white/10 bg-black/20",
  note: "border-amber-300/25 bg-amber-300/[0.06]",
  image: "border-sky-300/25 bg-sky-300/[0.05]",
  video: "border-fuchsia-300/25 bg-fuchsia-300/[0.05]",
  file: "border-white/10 bg-black/20",
  link: "border-white/10 bg-black/20",
};

const blockLabel: Record<FaqBlockType, string> = {
  heading: "Подзаголовок",
  text: "Абзац",
  note: "Заметка",
  image: "Фото",
  video: "Видео",
  file: "Файл",
  link: "Ссылка",
};

export function FaqBlockEditor({ name, initialBlocks }: { name: string; initialBlocks: FaqBlock[] }) {
  const [blocks, setBlocks] = useState<FaqBlock[]>(initialBlocks);
  const groupId = useId();

  const updateBlock = (index: number, patch: Partial<FaqBlock>) => {
    setBlocks((current) => current.map((block, i) => (i === index ? ({ ...block, ...patch } as FaqBlock) : block)));
  };

  const addBlock = (type: FaqBlockType) => setBlocks((current) => [...current, createBlock(type)]);

  const removeBlock = (index: number) => setBlocks((current) => current.filter((_, i) => i !== index));

  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(blocks)} />

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div
            key={`${groupId}-${index}`}
            className={cn("rounded-2xl border p-4 transition duration-200", blockAccent[block.type])}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-300">
                <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-black/40 px-1.5 text-[11px] text-primary">
                  {index + 1}
                </span>
                {blockLabel[block.type]}
              </span>
              <div className="flex items-center gap-1">
                <BlockIconButton label="Выше" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                  <ArrowUp className="h-4 w-4" />
                </BlockIconButton>
                <BlockIconButton
                  label="Ниже"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === blocks.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </BlockIconButton>
                <BlockIconButton label="Удалить блок" tone="danger" onClick={() => removeBlock(index)}>
                  <Trash2 className="h-4 w-4" />
                </BlockIconButton>
              </div>
            </div>

            <BlockFields block={block} index={index} onChange={updateBlock} />
          </div>
        ))}

        {!blocks.length ? (
          <p className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
            Пока пусто. Добавьте первый блок — текст, фото или ссылку. Блоков может быть сколько угодно, в любом порядке.
          </p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Добавить блок</div>
        <div className="flex flex-wrap gap-2">
          {[...TEXT_PALETTE, ...MEDIA_PALETTE, ...ATTACHMENT_PALETTE].map((entry) => (
            <button
              key={entry.type}
              type="button"
              onClick={() => addBlock(entry.type)}
              title={entry.hint}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-white transition duration-200 hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <entry.icon className="h-4 w-4 text-primary" aria-hidden="true" />
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockIconButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg border transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-30",
        tone === "danger"
          ? "border-rose-400/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
          : "border-white/10 bg-black/30 text-zinc-300 hover:border-white/25 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function BlockFields({
  block,
  index,
  onChange,
}: {
  block: FaqBlock;
  index: number;
  onChange: (index: number, patch: Partial<FaqBlock>) => void;
}) {
  const fieldId = useId();

  if (isTextBlock(block)) {
    const placeholder =
      block.type === "heading"
        ? "Например: Как привязать Telegram"
        : block.type === "note"
          ? "Короткий совет или важное предупреждение"
          : "Текст абзаца ответа";
    return (
      <div className="space-y-2">
        <Label htmlFor={fieldId} className="text-zinc-200">
          {block.type === "heading" ? "Текст подзаголовка" : block.type === "note" ? "Текст заметки" : "Текст абзаца"}
        </Label>
        <Textarea
          id={fieldId}
          value={block.text}
          onChange={(event) => onChange(index, { text: event.target.value })}
          rows={block.type === "heading" ? 2 : 4}
          placeholder={placeholder}
        />
      </div>
    );
  }

  if (isMediaBlock(block)) {
    return (
      <MediaBlockFields
        fieldId={fieldId}
        block={block}
        onUrl={(url, mimeType) => onChange(index, { url, ...(mimeType ? { mimeType } : {}) })}
        onCaption={(caption) => onChange(index, { caption })}
      />
    );
  }

  if (isAttachmentBlock(block)) {
    return (
      <AttachmentBlockFields
        fieldId={fieldId}
        block={block}
        onUrl={(url, mimeType) => onChange(index, { url, ...(mimeType ? { mimeType } : {}) })}
        onTitle={(title) => onChange(index, { title })}
      />
    );
  }

  return null;
}

function MediaBlockFields({
  fieldId,
  block,
  onUrl,
  onCaption,
}: {
  fieldId: string;
  block: Extract<FaqBlock, { type: "image" | "video" }>;
  onUrl: (url: string, mimeType?: string) => void;
  onCaption: (caption: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadFile(file, "faq");
      onUrl(url, file.type);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить файл.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor={fieldId} className="text-zinc-200">
            Ссылка на {block.type === "image" ? "фото" : "видео"}
          </Label>
          <Input
            id={fieldId}
            value={block.url}
            onChange={(event) => onUrl(event.target.value)}
            placeholder="https://... или загрузите файл"
          />
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={block.type === "image" ? "image/*" : "video/*"}
            className="hidden"
            onChange={onFileChange}
          />
          <Button type="button" variant="secondary" className="gap-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <FileUp className="h-4 w-4" />
            {uploading ? "Загрузка..." : "Загрузить"}
          </Button>
        </div>
      </div>

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      {block.url && block.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.url} alt={block.caption || "Предпросмотр"} className="max-h-52 w-full rounded-xl border border-white/10 object-cover" />
      ) : null}
      {block.url && block.type === "video" ? (
        <video src={block.url} controls className="max-h-52 w-full rounded-xl border border-white/10" />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-caption`} className="text-zinc-200">
          Подпись снизу <span className="text-zinc-500">(необязательно)</span>
        </Label>
        <Input
          id={`${fieldId}-caption`}
          value={block.caption ?? ""}
          onChange={(event) => onCaption(event.target.value)}
          placeholder="Подпись под изображением"
        />
      </div>
    </div>
  );
}

function AttachmentBlockFields({
  fieldId,
  block,
  onUrl,
  onTitle,
}: {
  fieldId: string;
  block: Extract<FaqBlock, { type: "file" | "link" }>;
  onUrl: (url: string, mimeType?: string) => void;
  onTitle: (title: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadFile(file, "faq");
      onUrl(url, file.type);
      if (!block.title.trim()) onTitle(file.name);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить файл.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-title`} className="text-zinc-200">
          Название
        </Label>
        <Input
          id={`${fieldId}-title`}
          value={block.title}
          onChange={(event) => onTitle(event.target.value)}
          placeholder={block.type === "file" ? "Регламент турнира.pdf" : "Открыть инструкцию"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor={fieldId} className="text-zinc-200">
            Ссылка
          </Label>
          <Input id={fieldId} value={block.url} onChange={(event) => onUrl(event.target.value)} placeholder="https://..." />
        </div>
        {block.type === "file" ? (
          <div>
            <input ref={inputRef} type="file" className="hidden" onChange={onFileChange} />
            <Button type="button" variant="secondary" className="gap-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <FileUp className="h-4 w-4" />
              {uploading ? "Загрузка..." : "Загрузить"}
            </Button>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
