"use client";

import { useState } from "react";
import { Eye, EyeOff, Save } from "lucide-react";
import type { FaqBlock } from "@/lib/faq/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaqBlockEditor } from "@/components/admin/faq-block-editor";

type FaqItemFormProps = {
  action: string;
  actionName?: "create" | "update";
  submitLabel: string;
  categories?: string[];
  item?: {
    id: string;
    title: string;
    category: string;
    sortOrder: number;
    isPublished: boolean;
    blocks: FaqBlock[];
  };
};

export function FaqItemForm({ action, actionName = "create", submitLabel, categories = [], item }: FaqItemFormProps) {
  const idBase = item ? item.id : "new";
  const [published, setPublished] = useState(item?.isPublished ?? true);

  return (
    <form action={action} method="post" className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="_action" value={actionName} />
      <input type="hidden" name="isPublished" value={String(published)} />

      <div className="grid gap-4 md:grid-cols-[1fr_180px_130px]">
        <div className="space-y-2">
          <Label htmlFor={`title-${idBase}`} className="text-zinc-200">
            Вопрос
          </Label>
          <Input id={`title-${idBase}`} name="title" defaultValue={item?.title ?? ""} required placeholder="Как привязать Telegram?" />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`category-${idBase}`} className="text-zinc-200">
            Категория
          </Label>
          <Input
            id={`category-${idBase}`}
            name="category"
            defaultValue={item?.category ?? "Общее"}
            list="faq-categories"
            placeholder="Общее"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`sort-${idBase}`} className="text-zinc-200">
            Порядок
          </Label>
          <Input id={`sort-${idBase}`} name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} />
        </div>
      </div>

      {categories.length ? (
        <datalist id="faq-categories">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      ) : null}

      <div className="space-y-2">
        <Label className="text-zinc-200">Содержание ответа</Label>
        <p className="text-xs leading-5 text-zinc-500">
          Собирайте ответ из блоков: текст, подзаголовки, заметки, фото и видео с подписями, файлы и ссылки. Порядок блоков
          меняется стрелками.
        </p>
        <FaqBlockEditor name="contentJson" initialBlocks={item?.blocks ?? []} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => setPublished((value) => !value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-4 text-sm font-medium text-white transition duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-pressed={published}
        >
          {published ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-zinc-400" />}
          {published ? "Опубликовано" : "Черновик"}
        </button>

        <Button className="gap-2">
          <Save className="h-4 w-4" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
