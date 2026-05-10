"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { FaqAttachmentKind } from "@prisma/client";
import { FileUp, LinkIcon, Plus, Trash2 } from "lucide-react";
import { genUploader } from "uploadthing/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OurFileRouter } from "@/lib/uploadthing/core";

const { uploadFiles } = genUploader<OurFileRouter>();

type AttachmentDraft = {
  title: string;
  url: string;
  kind: FaqAttachmentKind;
  mimeType?: string;
};

type FaqItemFormProps = {
  action: string;
  actionName?: "create" | "update";
  submitLabel: string;
  item?: {
    id: string;
    title: string;
    answer: string;
    category: string;
    sortOrder: number;
    isPublished: boolean;
    attachments: AttachmentDraft[];
  };
};

function inferKind(fileName: string, mimeType?: string): FaqAttachmentKind {
  if (mimeType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName)) return FaqAttachmentKind.IMAGE;
  if (mimeType?.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(fileName)) return FaqAttachmentKind.VIDEO;
  return FaqAttachmentKind.FILE;
}

export function FaqItemForm({ action, actionName = "create", submitLabel, item }: FaqItemFormProps) {
  const [attachments, setAttachments] = useState<AttachmentDraft[]>(item?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const addAttachment = (attachment: AttachmentDraft) => {
    if (!attachment.url.trim()) return;
    setAttachments((current) => [...current, attachment]);
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const [uploaded] = await uploadFiles("faqAttachmentUploader", { files: [file] });
      const url = uploaded.serverData?.url || uploaded.ufsUrl || uploaded.url;
      if (!url) throw new Error("empty-upload-url");

      addAttachment({
        title: file.name,
        url,
        kind: inferKind(file.name, file.type),
        mimeType: file.type,
      });
    } catch {
      setUploadError("Не удалось загрузить файл. Можно вставить ссылку вручную.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <form action={action} method="post" className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="_action" value={actionName} />
      <input type="hidden" name="attachmentsJson" value={JSON.stringify(attachments)} />

      <div className="grid gap-4 md:grid-cols-[1fr_160px_140px]">
        <div className="space-y-2">
          <Label htmlFor={item ? `title-${item.id}` : "title-new"}>Вопрос</Label>
          <Input id={item ? `title-${item.id}` : "title-new"} name="title" defaultValue={item?.title ?? ""} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor={item ? `category-${item.id}` : "category-new"}>Категория</Label>
          <Input id={item ? `category-${item.id}` : "category-new"} name="category" defaultValue={item?.category ?? "Общее"} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={item ? `sort-${item.id}` : "sort-new"}>Порядок</Label>
          <Input id={item ? `sort-${item.id}` : "sort-new"} name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={item ? `answer-${item.id}` : "answer-new"}>Ответ</Label>
        <Textarea id={item ? `answer-${item.id}` : "answer-new"} name="answer" rows={item ? 5 : 7} defaultValue={item?.answer ?? ""} required />
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor={item ? `file-${item.id}` : "file-new"}>Прикрепить файл или фото</Label>
          <Input
            id={item ? `file-${item.id}` : "file-new"}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
            onChange={onFileChange}
            disabled={uploading}
            className="pt-2 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
          />
          {uploadError ? <div className="text-xs text-rose-300">{uploadError}</div> : null}
        </div>
        <Button type="button" variant="secondary" disabled={uploading} className="gap-2">
          <FileUp className="h-4 w-4" />
          {uploading ? "Загрузка..." : "Файл"}
        </Button>
      </div>

      <AttachmentUrlAdder onAdd={addAttachment} />

      {attachments.length ? (
        <div className="grid gap-2">
          {attachments.map((attachment, index) => (
            <div key={`${attachment.url}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{attachment.title || attachment.url}</div>
                <div className="truncate text-xs text-zinc-500">{attachment.kind} · {attachment.url}</div>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                onClick={() => setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                aria-label="Удалить вложение"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <label className="flex items-center gap-3 text-sm text-zinc-300">
        <input type="checkbox" name="isPublished" value="true" defaultChecked={item?.isPublished ?? true} className="h-4 w-4 rounded border-white/20 bg-black/40" />
        Опубликовано
      </label>

      <Button className="gap-2" disabled={uploading}>
        <Plus className="h-4 w-4" />
        {submitLabel}
      </Button>
    </form>
  );
}

function AttachmentUrlAdder({ onAdd }: { onAdd: (attachment: AttachmentDraft) => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<FaqAttachmentKind>(FaqAttachmentKind.LINK);

  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_1.4fr_150px_auto] lg:items-end">
      <div className="space-y-2">
        <Label>Название ссылки</Label>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Скриншот, регламент, инструкция" />
      </div>
      <div className="space-y-2">
        <Label>URL</Label>
        <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
      </div>
      <div className="space-y-2">
        <Label>Тип</Label>
        <select value={kind} onChange={(event) => setKind(event.target.value as FaqAttachmentKind)} className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white">
          <option value={FaqAttachmentKind.LINK}>Ссылка</option>
          <option value={FaqAttachmentKind.IMAGE}>Фото</option>
          <option value={FaqAttachmentKind.FILE}>Файл</option>
          <option value={FaqAttachmentKind.VIDEO}>Видео</option>
        </select>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="gap-2"
        onClick={() => {
          onAdd({ title: title.trim() || url.trim(), url: url.trim(), kind });
          setTitle("");
          setUrl("");
          setKind(FaqAttachmentKind.LINK);
        }}
      >
        <LinkIcon className="h-4 w-4" />
        Добавить
      </Button>
    </div>
  );
}
