export const TELEGRAM_TEXT_LIMIT = 4096;
export const TELEGRAM_CAPTION_LIMIT = 1024;

export type TelegramBroadcastButtonDraft = {
  text: string;
  url: string;
  row: number;
};

const supportedTagPatterns = [
  /<blockquote expandable>/gi,
  /<span class="tg-spoiler">/gi,
  /<tg-time unix="\d+"(?: format="[A-Za-z]+")?>/gi,
  /<tg-emoji emoji-id="\d+">/gi,
  /<a href="(?:https?:\/\/|tg:\/\/)[^"\r\n<>]*">/gi,
  /<code class="language-[A-Za-z0-9_+-]+">/gi,
  /<blockquote>/gi,
  /<\/blockquote>/gi,
  /<pre>/gi,
  /<\/pre>/gi,
  /<code>/gi,
  /<\/code>/gi,
  /<tg-spoiler>/gi,
  /<\/tg-spoiler>/gi,
  /<\/tg-time>/gi,
  /<\/tg-emoji>/gi,
  /<\/a>/gi,
  /<b>/gi,
  /<\/b>/gi,
  /<strong>/gi,
  /<\/strong>/gi,
  /<i>/gi,
  /<\/i>/gi,
  /<em>/gi,
  /<\/em>/gi,
  /<u>/gi,
  /<\/u>/gi,
  /<ins>/gi,
  /<\/ins>/gi,
  /<s>/gi,
  /<\/s>/gi,
  /<strike>/gi,
  /<\/strike>/gi,
  /<del>/gi,
  /<\/del>/gi,
  /<\/span>/gi,
];

const supportedHtmlTagRegex =
  /<\/?(?:b|strong|i|em|u|ins|s|strike|del|tg-spoiler|span|a|code|pre|blockquote|tg-time|tg-emoji)\b[^>]*>/gi;

const structuralTagRegex = /<\/?[^>]+>/g;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeTelegramHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => {
      const number = Number(code);
      return Number.isFinite(number) ? String.fromCodePoint(number) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const number = Number.parseInt(code, 16);
      return Number.isFinite(number) ? String.fromCodePoint(number) : _;
    });
}

function normalizeTagToken(tag: string) {
  const value = tag.toLowerCase();

  if (value === "<blockquote>" || value === "<blockquote expandable>") return { kind: "open" as const, name: "blockquote" };
  if (value === "</blockquote>") return { kind: "close" as const, name: "blockquote" };
  if (value === "<pre>") return { kind: "open" as const, name: "pre" };
  if (value === "</pre>") return { kind: "close" as const, name: "pre" };
  if (value === "<code>" || value.startsWith('<code class="language-')) return { kind: "open" as const, name: "code" };
  if (value === "</code>") return { kind: "close" as const, name: "code" };
  if (value === "<tg-spoiler>") return { kind: "open" as const, name: "tg-spoiler" };
  if (value === "</tg-spoiler>") return { kind: "close" as const, name: "tg-spoiler" };
  if (value === '<span class="tg-spoiler">') return { kind: "open" as const, name: "span" };
  if (value === "</span>") return { kind: "close" as const, name: "span" };
  if (value.startsWith("<a href=")) return { kind: "open" as const, name: "a" };
  if (value === "</a>") return { kind: "close" as const, name: "a" };
  if (value.startsWith("<tg-time ")) return { kind: "open" as const, name: "tg-time" };
  if (value === "</tg-time>") return { kind: "close" as const, name: "tg-time" };
  if (value.startsWith("<tg-emoji ")) return { kind: "open" as const, name: "tg-emoji" };
  if (value === "</tg-emoji>") return { kind: "close" as const, name: "tg-emoji" };
  if (/^<(b|strong|i|em|u|ins|s|strike|del)>$/.test(value)) return { kind: "open" as const, name: value.slice(1, -1) };
  if (/^<\/(b|strong|i|em|u|ins|s|strike|del)>$/.test(value)) return { kind: "close" as const, name: value.slice(2, -1) };

  return null;
}

export function sanitizeTelegramHtml(input: string) {
  let value = input.replace(/\r\n/g, "\n").trim();
  const tags: string[] = [];

  for (const pattern of supportedTagPatterns) {
    value = value.replace(pattern, (match) => {
      const token = `%%TG_TAG_${tags.length}%%`;
      tags.push(match);
      return token;
    });
  }

  value = escapeHtml(value);

  for (let index = 0; index < tags.length; index += 1) {
    value = value.replace(`%%TG_TAG_${index}%%`, tags[index]);
  }

  return value;
}

export function hasTelegramHtmlFormatting(input: string) {
  return new RegExp(supportedHtmlTagRegex.source, "gi").test(input);
}

export function getTelegramRenderedTextLength(input: string) {
  const withoutTags = input.replace(new RegExp(supportedHtmlTagRegex.source, "gi"), "");
  return decodeTelegramHtmlEntities(withoutTags).length;
}

export function validateTelegramHtmlStructure(input: string) {
  const stack: string[] = [];
  const matches = input.match(structuralTagRegex) ?? [];

  for (const match of matches) {
    const token = normalizeTagToken(match);

    if (!token) {
      return `Неподдерживаемый HTML-тег: ${match}`;
    }

    if (token.kind === "open") {
      stack.push(token.name);
      continue;
    }

    const current = stack.pop();
    if (current !== token.name) {
      return `Проверьте закрывающий тег ${match}.`;
    }
  }

  if (stack.length) {
    return `Не закрыт тег <${stack[stack.length - 1]}>.`;
  }

  return null;
}

export function buildTelegramPreviewHtml(input: string) {
  return sanitizeTelegramHtml(input)
    .replace(/<tg-spoiler>/gi, '<span class="tg-spoiler">')
    .replace(/<\/tg-spoiler>/gi, "</span>")
    .replace(/<blockquote expandable>/gi, '<blockquote class="is-expandable">');
}

export function parseTelegramButtonsJson(raw: string) {
  if (!raw.trim()) return [] as TelegramBroadcastButtonDraft[];

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Не удалось прочитать кнопки рассылки.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Кнопки должны передаваться списком.");
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Кнопка ${index + 1} заполнена некорректно.`);
    }

    const text = typeof item.text === "string" ? item.text.trim() : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";
    const row = Number(item.row);

    if (!text) {
      throw new Error(`Укажите текст для кнопки ${index + 1}.`);
    }

    if (!url) {
      throw new Error(`Укажите ссылку для кнопки ${index + 1}.`);
    }

    if (!/^(https?:\/\/|tg:\/\/)/i.test(url)) {
      throw new Error(`Ссылка кнопки ${index + 1} должна начинаться с https://, http:// или tg://.`);
    }

    if (!Number.isInteger(row) || row < 1 || row > 8) {
      throw new Error(`Ряд кнопки ${index + 1} должен быть от 1 до 8.`);
    }

    return { text, url, row };
  });
}

export function buildTelegramInlineKeyboard(buttons: TelegramBroadcastButtonDraft[]) {
  if (!buttons.length) return undefined;

  const rows = new Map<number, { text: string; url: string }[]>();

  for (const button of [...buttons].sort((first, second) => first.row - second.row)) {
    const row = rows.get(button.row) ?? [];
    row.push({ text: button.text, url: button.url });
    rows.set(button.row, row);
  }

  return {
    inline_keyboard: Array.from(rows.values()),
  };
}
