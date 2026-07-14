"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, LoaderCircle, Plus, Radio, Send, Sparkles, TableProperties, Trash2, Trophy, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildTelegramPreviewHtml, type TelegramBroadcastButtonDraft } from "@/lib/telegram-format";

const DRAFT_STORAGE_KEY = "admin.telegram-broadcast-draft.v2";

type TelegramBroadcastFormProps = {
  error?: string;
  sent?: string;
  failed?: string;
  tournaments: Array<{
    id: string;
    title: string;
    status: string;
    startsAt: string;
    registrationEndsAt: string;
    maxParticipants: number;
    participantsCount: number;
    prizePool: string | null;
    coverImage: string | null;
    groups: Array<{ id: string; name: string }>;
  }>;
};

type DraftButton = TelegramBroadcastButtonDraft & {
  id: string;
};

function createButtonDraft(row = 1): DraftButton {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: "",
    url: "",
    row,
  };
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function groupButtonsByRow(buttons: DraftButton[]) {
  const rows = new Map<number, DraftButton[]>();

  for (const button of [...buttons].sort((first, second) => first.row - second.row)) {
    const row = rows.get(button.row) ?? [];
    row.push(button);
    rows.set(button.row, row);
  }

  return Array.from(rows.entries());
}

export function TelegramBroadcastForm({
  error,
  sent,
  failed,
  tournaments,
}: TelegramBroadcastFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  const [mediaType, setMediaType] = useState("text");
  const [mediaUrl, setMediaUrl] = useState("");
  const [buttons, setButtons] = useState<DraftButton[]>([]);
  const [contentSource, setContentSource] = useState<"manual" | "tournament">("manual");
  const [template, setTemplate] = useState<"announcement" | "bulletin">("announcement");
  const [audience, setAudience] = useState<"all" | "participants" | "group" | "applicants" | "unresolved">("all");
  const [tournamentId, setTournamentId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (sent) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      setIsDraftReady(true);
      return;
    }

    const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) {
      setIsDraftReady(true);
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as {
        text?: string;
        mediaType?: string;
        mediaUrl?: string;
        buttons?: Array<{ id?: string; text?: string; url?: string; row?: number }>;
        contentSource?: "manual" | "tournament";
        template?: "announcement" | "bulletin";
        audience?: "all" | "participants" | "group" | "applicants" | "unresolved";
        tournamentId?: string;
        groupId?: string;
      };

      setText(typeof draft.text === "string" ? draft.text : "");
      setMediaType(typeof draft.mediaType === "string" ? draft.mediaType : "text");
      setMediaUrl(typeof draft.mediaUrl === "string" ? draft.mediaUrl : "");
      setButtons(
        Array.isArray(draft.buttons)
          ? draft.buttons.map((button, index) => ({
              id: typeof button.id === "string" ? button.id : `restored-${index}`,
              text: typeof button.text === "string" ? button.text : "",
              url: typeof button.url === "string" ? button.url : "",
              row: typeof button.row === "number" && Number.isInteger(button.row) ? button.row : 1,
            }))
          : [],
      );
      setContentSource(draft.contentSource === "tournament" ? "tournament" : "manual");
      setTemplate(draft.template === "bulletin" ? "bulletin" : "announcement");
      setAudience(["participants", "group", "applicants", "unresolved"].includes(draft.audience ?? "")
        ? draft.audience as "participants" | "group" | "applicants" | "unresolved"
        : "all");
      setTournamentId(typeof draft.tournamentId === "string" ? draft.tournamentId : "");
      setGroupId(typeof draft.groupId === "string" ? draft.groupId : "");
    } catch {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } finally {
      setIsDraftReady(true);
    }
  }, [sent]);

  useEffect(() => {
    if (!isDraftReady || typeof window === "undefined") return;

    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        text,
        mediaType,
        mediaUrl,
        buttons,
        contentSource,
        template,
        audience,
        tournamentId,
        groupId,
      }),
    );
  }, [audience, buttons, contentSource, groupId, isDraftReady, mediaType, mediaUrl, template, text, tournamentId]);

  function focusTextarea(selectionStart: number, selectionEnd: number) {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function wrapSelection(openTag: string, closeTag: string, placeholder: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart ?? text.length;
    const selectionEnd = textarea.selectionEnd ?? text.length;
    const selectedText = text.slice(selectionStart, selectionEnd) || placeholder;
    const nextText = `${text.slice(0, selectionStart)}${openTag}${selectedText}${closeTag}${text.slice(selectionEnd)}`;
    const nextSelectionStart = selectionStart + openTag.length;
    const nextSelectionEnd = nextSelectionStart + selectedText.length;

    setText(nextText);
    focusTextarea(nextSelectionStart, nextSelectionEnd);
  }

  function insertLink() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart ?? text.length;
    const selectionEnd = textarea.selectionEnd ?? text.length;
    const selectedText = text.slice(selectionStart, selectionEnd) || "ссылка";
    const url = window.prompt("Введите URL для ссылки (https://... или tg://...)", "https://");

    if (!url) return;

    const normalizedUrl = url.trim();
    if (!/^(https?:\/\/|tg:\/\/)/i.test(normalizedUrl)) {
      window.alert("Ссылка должна начинаться с https://, http:// или tg://");
      return;
    }

    const openTag = `<a href="${escapeHtmlAttribute(normalizedUrl)}">`;
    const closeTag = "</a>";
    const nextText = `${text.slice(0, selectionStart)}${openTag}${selectedText}${closeTag}${text.slice(selectionEnd)}`;
    const nextSelectionStart = selectionStart + openTag.length;
    const nextSelectionEnd = nextSelectionStart + selectedText.length;

    setText(nextText);
    focusTextarea(nextSelectionStart, nextSelectionEnd);
  }

  function addButton() {
    const nextRow = buttons.length ? Math.max(...buttons.map((button) => button.row)) : 0;
    setButtons((current) => [...current, createButtonDraft(Math.min(nextRow + 1, 8))]);
  }

  function updateButton(id: string, patch: Partial<DraftButton>) {
    setButtons((current) => current.map((button) => (button.id === id ? { ...button, ...patch } : button)));
  }

  function removeButton(id: string) {
    setButtons((current) => current.filter((button) => button.id !== id));
  }

  const previewHtml = buildTelegramPreviewHtml(text);
  const selectedTournament = tournaments.find((tournament) => tournament.id === tournamentId) ?? null;
  const availableGroups = selectedTournament?.groups ?? [];
  const buttonRows = groupButtonsByRow(buttons.filter((button) => button.text.trim() && button.url.trim()));
  const buttonsPayload = buttons
    .filter((button) => button.text.trim() || button.url.trim())
    .map((button) => ({
      text: button.text.trim(),
      url: button.url.trim(),
      row: button.row,
    }));

  return (
    <>
      {error ? (
        <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}
      {sent ? (
        <div role="status" aria-live="polite" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Отправлено: {sent}. Ошибок: {failed ?? 0}.
        </div>
      ) : null}

      <form
        action="/api/admin/broadcasts"
        method="post"
        encType="multipart/form-data"
        className="space-y-6"
        onSubmit={() => setIsSubmitting(true)}
      >
        <input type="hidden" name="buttonsJson" value={JSON.stringify(buttonsPayload)} />

        <section className="overflow-hidden rounded-3xl border border-sky-400/20 bg-gradient-to-br from-sky-500/[0.10] via-[#07111f] to-cyan-500/[0.06] p-4 shadow-[0_24px_80px_rgba(2,132,199,0.10)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold text-white">
                <Sparkles className="h-5 w-5 text-sky-300" aria-hidden="true" />
                Сценарий публикации
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-300">
                Создайте сообщение вручную или соберите готовый rich-пост из актуальных данных турнира.
              </p>
            </div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              Bot API Rich Messages
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-white">Источник</span>
              <select
                name="contentSource"
                value={contentSource}
                onChange={(event) => setContentSource(event.target.value === "tournament" ? "tournament" : "manual")}
                className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <option className="bg-zinc-950" value="manual">Ручное сообщение</option>
                <option className="bg-zinc-950" value="tournament">Данные турнира</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-white">Аудитория</span>
              <select
                name="audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value as typeof audience)}
                className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <option className="bg-zinc-950" value="all">Все связанные аккаунты</option>
                <option className="bg-zinc-950" value="participants">Участники турнира</option>
                <option className="bg-zinc-950" value="group">Участники группы</option>
                <option className="bg-zinc-950" value="applicants">Заявки на рассмотрении</option>
                <option className="bg-zinc-950" value="unresolved">Игроки без результата</option>
              </select>
            </label>

            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm font-medium text-white">Турнир</span>
              <select
                name="tournamentId"
                value={tournamentId}
                onChange={(event) => {
                  setTournamentId(event.target.value);
                  setGroupId("");
                }}
                required={contentSource === "tournament" || audience !== "all"}
                className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50"
              >
                <option className="bg-zinc-950" value="">Выберите турнир</option>
                {tournaments.map((tournament) => (
                  <option className="bg-zinc-950" key={tournament.id} value={tournament.id}>{tournament.title}</option>
                ))}
              </select>
            </label>

            {contentSource === "tournament" ? (
              <label className="space-y-2 md:col-span-1">
                <span className="text-sm font-medium text-white">Шаблон</span>
                <select
                  name="template"
                  value={template}
                  onChange={(event) => setTemplate(event.target.value === "bulletin" ? "bulletin" : "announcement")}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <option className="bg-zinc-950" value="announcement">Анонс регистрации</option>
                  <option className="bg-zinc-950" value="bulletin">Таблицы и расписание</option>
                </select>
              </label>
            ) : <input type="hidden" name="template" value="announcement" />}

            {audience === "group" ? (
              <label className="space-y-2 md:col-span-1">
                <span className="text-sm font-medium text-white">Группа</span>
                <select
                  name="groupId"
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                  required
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <option className="bg-zinc-950" value="">Выберите группу</option>
                  {availableGroups.map((group) => (
                    <option className="bg-zinc-950" key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </label>
            ) : <input type="hidden" name="groupId" value="" />}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {contentSource === "tournament" ? (
              <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                    {template === "announcement" ? <Trophy className="h-5 w-5" aria-hidden="true" /> : <TableProperties className="h-5 w-5" aria-hidden="true" />}
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {template === "announcement" ? "Анонс регистрации" : "Турнирный бюллетень"}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      {selectedTournament
                        ? `Сообщение будет собрано из актуальных данных «${selectedTournament.title}» непосредственно перед отправкой.`
                        : "Выберите турнир выше, чтобы сформировать rich-сообщение."}
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <FileText className="h-4 w-4 text-sky-300" aria-hidden="true" />
                    <div className="mt-2 text-xs text-zinc-500">Формат</div>
                    <div className="mt-0.5 text-sm font-medium text-white">Rich blocks</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <UsersRound className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                    <div className="mt-2 text-xs text-zinc-500">Участники</div>
                    <div className="mt-0.5 text-sm font-medium text-white tabular-nums">{selectedTournament?.participantsCount ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <Radio className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    <div className="mt-2 text-xs text-zinc-500">Доставка</div>
                    <div className="mt-0.5 text-sm font-medium text-white">С fallback</div>
                  </div>
                </div>
              </div>
            ) : null}

            <label className={contentSource === "manual" ? "block space-y-2" : "hidden"}>
              <span className="text-sm font-medium text-white">Текст</span>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => wrapSelection("<b>", "</b>", "жирный текст")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Жирный
                  </button>
                  <button type="button" onClick={() => wrapSelection("<i>", "</i>", "курсив")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Курсив
                  </button>
                  <button type="button" onClick={() => wrapSelection("<u>", "</u>", "подчёркнутый текст")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Подчёркнутый
                  </button>
                  <button type="button" onClick={() => wrapSelection("<s>", "</s>", "зачёркнутый текст")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Зачёркнутый
                  </button>
                  <button type="button" onClick={() => wrapSelection("<tg-spoiler>", "</tg-spoiler>", "скрытый текст")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Спойлер
                  </button>
                  <button type="button" onClick={() => wrapSelection("<blockquote>", "</blockquote>", "цитата")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Цитата
                  </button>
                  <button type="button" onClick={() => wrapSelection("<blockquote expandable>", "</blockquote>", "сворачиваемая цитата")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Сворачиваемая цитата
                  </button>
                  <button type="button" onClick={() => wrapSelection("<code>", "</code>", "код")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Код
                  </button>
                  <button type="button" onClick={() => wrapSelection('<pre><code class="language-plain">', "</code></pre>", "блок кода")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Блок кода
                  </button>
                  <button type="button" onClick={insertLink} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    Ссылка
                  </button>
                </div>

                <Textarea
                  ref={textareaRef}
                  name="text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Напишите сообщение. Для Telegram HTML можно использовать теги вручную или вставлять их кнопками сверху."
                  className="min-h-[260px] border-0 bg-transparent px-0 py-0 focus-visible:ring-0"
                />

                <div className="mt-3 text-xs text-zinc-500">
                  Поддерживается Telegram HTML: жирный, курсив, подчёркивание, зачёркивание, спойлер, цитаты, код, ссылки. Дополнительно можно вручную использовать <code className="rounded bg-white/10 px-1 py-0.5 text-[11px] text-zinc-300">&lt;tg-time&gt;</code> и <code className="rounded bg-white/10 px-1 py-0.5 text-[11px] text-zinc-300">&lt;tg-emoji&gt;</code>.
                </div>
              </div>
            </label>

            <div className={contentSource === "manual" ? "grid gap-4 md:grid-cols-2" : "hidden"}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">Тип рассылки</span>
                <select
                  name="mediaType"
                  value={mediaType}
                  onChange={(event) => setMediaType(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option className="bg-zinc-950" value="text">
                    Только текст
                  </option>
                  <option className="bg-zinc-950" value="photo">
                    Фото
                  </option>
                  <option className="bg-zinc-950" value="video">
                    Видео
                  </option>
                  <option className="bg-zinc-950" value="document">
                    Документ
                  </option>
                  <option className="bg-zinc-950" value="animation">
                    GIF / анимация
                  </option>
                  <option className="bg-zinc-950" value="audio">
                    Аудио
                  </option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">Ссылка на медиа</span>
                <Input
                  name="mediaUrl"
                  type="url"
                  placeholder="https://example.com/file.jpg"
                  value={mediaUrl}
                  onChange={(event) => setMediaUrl(event.target.value)}
                />
              </label>
            </div>

            <label className={contentSource === "manual" ? "block space-y-2" : "hidden"}>
              <span className="text-sm font-medium text-white">Файл</span>
              <Input
                name="mediaFile"
                type="file"
                accept="image/*,video/*,audio/*,.gif,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                className="pt-2 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
              />
              <span className="block text-xs text-zinc-500">Для медиа можно прикрепить файл или указать ссылку. Для текстовой рассылки эти поля игнорируются.</span>
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">Inline-кнопки</div>
                  <div className="mt-1 text-xs text-zinc-500">Кнопки добавляются прямо под сообщением Telegram. Поддерживаются URL и tg:// ссылки.</div>
                </div>
                <Button type="button" variant="outline" className="gap-2" onClick={addButton}>
                  <Plus className="h-4 w-4" />
                  Добавить кнопку
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {buttons.length ? (
                  buttons.map((button) => {
                    const buttonHasContent = button.text.trim().length > 0 || button.url.trim().length > 0;

                    return (
                      <div key={button.id} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_110px_auto]">
                        <Input
                          value={button.text}
                          onChange={(event) => updateButton(button.id, { text: event.target.value })}
                          placeholder="Текст кнопки"
                          maxLength={64}
                          required={buttonHasContent}
                        />
                        <Input
                          value={button.url}
                          onChange={(event) => updateButton(button.id, { url: event.target.value })}
                          placeholder="https://example.com"
                          required={buttonHasContent}
                        />
                        <Input
                          type="number"
                          min={1}
                          max={8}
                          value={button.row}
                          onChange={(event) => updateButton(button.id, { row: Math.max(1, Math.min(8, Number(event.target.value) || 1)) })}
                          placeholder="Ряд"
                        />
                        <Button type="button" variant="ghost" className="gap-2 text-rose-200 hover:text-rose-100" onClick={() => removeButton(button.id)}>
                          <Trash2 className="h-4 w-4" />
                          Удалить
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-500">
                    Кнопок пока нет. Добавьте одну или несколько и распределите их по рядам.
                  </div>
                )}
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              <input name="confirm" type="checkbox" className="mt-1 h-5 w-5 shrink-0 rounded border-white/20 bg-black/40 accent-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black" required />
              <span>
                Подтверждаю отправку выбранной аудитории
                {selectedTournament && audience !== "all" ? ` турнира «${selectedTournament.title}»` : ""}.
              </span>
            </label>

            <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto" disabled={isSubmitting}>
              {isSubmitting
                ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                : <Send className="h-4 w-4" aria-hidden="true" />}
              {isSubmitting ? "Отправляем…" : "Отправить рассылку"}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-medium text-white">Предпросмотр</div>
              <div className="mt-1 text-xs text-zinc-500">Визуально приближен к Telegram, чтобы удобно проверить разметку перед отправкой.</div>

              <div className="mt-4 rounded-[28px] bg-[#1D1D1D] p-3">
                <div className="rounded-[20px] bg-[#1D1D1D] px-4 py-3 text-[15px] leading-6 text-white shadow-[0_14px_28px_rgba(0,0,0,0.24)]">
                  {contentSource === "tournament" && selectedTournament ? (
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-2xl border border-sky-300/15 bg-gradient-to-br from-sky-500/15 via-white/[0.04] to-cyan-400/10 p-4">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                          {template === "announcement" ? <Trophy className="h-4 w-4" aria-hidden="true" /> : <TableProperties className="h-4 w-4" aria-hidden="true" />}
                          {template === "announcement" ? "Регистрация открыта" : "Центр турнира"}
                        </div>
                        <div className="mt-3 text-lg font-semibold leading-6 text-white">{selectedTournament.title}</div>
                        {template === "announcement" ? (
                          <div className="mt-4 overflow-hidden rounded-xl border border-white/10 text-xs">
                            {[
                              ["Старт", new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(selectedTournament.startsAt))],
                              ["Участники", `${selectedTournament.participantsCount} из ${selectedTournament.maxParticipants}`],
                              ["Свободно", String(Math.max(0, selectedTournament.maxParticipants - selectedTournament.participantsCount))],
                              ["Призовой фонд", selectedTournament.prizePool || "Не указан"],
                            ].map(([label, value], index) => (
                              <div key={label} className={`grid grid-cols-[105px_1fr] gap-3 px-3 py-2.5 ${index % 2 ? "bg-white/[0.04]" : "bg-black/10"}`}>
                                <span className="text-zinc-400">{label}</span>
                                <span className="text-right font-medium text-white">{value}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                              <div className="text-xs font-semibold text-white">Таблицы</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(selectedTournament.groups.length ? selectedTournament.groups : [{ id: "empty", name: "Основной этап" }]).slice(0, 4).map((group) => (
                                  <span key={group.id} className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-300">{group.name}</span>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-xs text-zinc-300">
                              Ближайшие матчи, статусы и дедлайны будут подставлены автоматически.
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-center text-sm font-medium text-sky-100">
                        {template === "announcement" ? "Зарегистрироваться" : "Открыть турнир"}
                      </div>
                    </div>
                  ) : text.trim() ? (
                    <div
                      className="whitespace-pre-wrap break-words [&_.tg-spoiler]:rounded [&_.tg-spoiler]:bg-white/25 [&_.tg-spoiler]:px-1 [&_.tg-spoiler]:text-transparent hover:[&_.tg-spoiler]:text-white [&_a]:text-sky-200 [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-white/25 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-black/25 [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/25 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <div className="text-white/60">Здесь появится текст сообщения.</div>
                  )}

                  {buttonRows.length ? (
                    <div className="mt-4 space-y-2">
                      {buttonRows.map(([row, rowButtons]) => (
                        <div
                          key={row}
                          className="grid gap-2"
                          style={{ gridTemplateColumns: `repeat(${rowButtons.length}, minmax(0, 1fr))` }}
                        >
                          {rowButtons.map((button) => (
                            <div key={button.id} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-center text-sm font-medium text-white">
                              {button.text}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
              <div className="font-medium text-white">Черновик</div>
              <div className="mt-1">
                Текст, тип рассылки, ссылка на медиа и кнопки сохраняются локально в браузере, чтобы черновик не потерялся при ошибке отправки.
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
