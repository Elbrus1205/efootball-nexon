import { FaqAttachmentKind } from "@prisma/client";

/**
 * Rich FAQ content is stored as an ordered list of blocks in `FaqItem.contentJson`.
 * Legacy rows keep their plain-text `answer` (+ optional `FaqAttachment[]`); when
 * `contentJson` is empty we rebuild an equivalent block list from those fields so
 * nothing that was published before this feature disappears.
 */

export const FAQ_BLOCK_TYPES = ["heading", "text", "note", "image", "video", "file", "link"] as const;

export type FaqBlockType = (typeof FAQ_BLOCK_TYPES)[number];

export type FaqTextBlock = {
  type: "heading" | "text" | "note";
  text: string;
};

export type FaqMediaBlock = {
  type: "image" | "video";
  url: string;
  caption?: string;
  mimeType?: string;
};

export type FaqAttachmentBlock = {
  type: "file" | "link";
  url: string;
  title: string;
  mimeType?: string;
};

export type FaqBlock = FaqTextBlock | FaqMediaBlock | FaqAttachmentBlock;

export const FAQ_TEXT_BLOCK_TYPES: FaqBlockType[] = ["heading", "text", "note"];
export const FAQ_MEDIA_BLOCK_TYPES: FaqBlockType[] = ["image", "video"];
export const FAQ_ATTACHMENT_BLOCK_TYPES: FaqBlockType[] = ["file", "link"];

export function isTextBlock(block: FaqBlock): block is FaqTextBlock {
  return block.type === "heading" || block.type === "text" || block.type === "note";
}

export function isMediaBlock(block: FaqBlock): block is FaqMediaBlock {
  return block.type === "image" || block.type === "video";
}

export function isAttachmentBlock(block: FaqBlock): block is FaqAttachmentBlock {
  return block.type === "file" || block.type === "link";
}

/** Coerces arbitrary parsed JSON into a clean, safe list of blocks. */
export function normalizeFaqBlocks(input: unknown): FaqBlock[] {
  if (!Array.isArray(input)) return [];

  const blocks: FaqBlock[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Record<string, unknown>;
    const type = typeof candidate.type === "string" ? candidate.type : "";

    if (type === "heading" || type === "text" || type === "note") {
      const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
      if (text) blocks.push({ type, text });
      continue;
    }

    if (type === "image" || type === "video") {
      const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
      if (!url) continue;
      const caption = typeof candidate.caption === "string" ? candidate.caption.trim() : "";
      const mimeType = typeof candidate.mimeType === "string" ? candidate.mimeType.trim() : "";
      blocks.push({ type, url, ...(caption ? { caption } : {}), ...(mimeType ? { mimeType } : {}) });
      continue;
    }

    if (type === "file" || type === "link") {
      const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
      if (!url) continue;
      const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : url;
      const mimeType = typeof candidate.mimeType === "string" ? candidate.mimeType.trim() : "";
      blocks.push({ type, url, title, ...(mimeType ? { mimeType } : {}) });
    }
  }

  return blocks;
}

export function parseFaqBlocks(contentJson: string | null | undefined): FaqBlock[] {
  if (!contentJson || !contentJson.trim()) return [];
  try {
    return normalizeFaqBlocks(JSON.parse(contentJson));
  } catch {
    return [];
  }
}

export function stringifyFaqBlocks(blocks: FaqBlock[]): string {
  return JSON.stringify(normalizeFaqBlocks(blocks));
}

/** Splits legacy plain-text answers into paragraph text blocks. */
export function answerToBlocks(answer: string): FaqBlock[] {
  return answer
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((text) => ({ type: "text", text }) satisfies FaqTextBlock);
}

type LegacyAttachment = {
  title: string;
  url: string;
  kind: FaqAttachmentKind;
  mimeType?: string | null;
};

/** Rebuilds legacy `FaqAttachment` rows as media/attachment blocks. */
export function attachmentsToBlocks(attachments: LegacyAttachment[]): FaqBlock[] {
  return attachments.map((attachment) => {
    if (attachment.kind === FaqAttachmentKind.IMAGE) {
      return {
        type: "image",
        url: attachment.url,
        ...(attachment.title ? { caption: attachment.title } : {}),
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
      } satisfies FaqMediaBlock;
    }
    if (attachment.kind === FaqAttachmentKind.VIDEO) {
      return {
        type: "video",
        url: attachment.url,
        ...(attachment.title ? { caption: attachment.title } : {}),
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
      } satisfies FaqMediaBlock;
    }
    return {
      type: attachment.kind === FaqAttachmentKind.FILE ? "file" : "link",
      url: attachment.url,
      title: attachment.title || attachment.url,
      ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
    } satisfies FaqAttachmentBlock;
  });
}

/**
 * Resolves the blocks to render for a stored FAQ row: prefers structured
 * `contentJson`, otherwise reconstructs blocks from the legacy answer + attachments.
 */
export function resolveFaqBlocks(row: {
  contentJson?: string | null;
  answer?: string | null;
  attachments?: LegacyAttachment[];
}): FaqBlock[] {
  const structured = parseFaqBlocks(row.contentJson);
  if (structured.length) return structured;

  const blocks = answerToBlocks(row.answer ?? "");
  if (row.attachments?.length) blocks.push(...attachmentsToBlocks(row.attachments));
  return blocks;
}

/** Derives the plain-text answer kept in the NOT NULL `answer` column + used for search. */
export function blocksToPlainText(blocks: FaqBlock[]): string {
  return blocks
    .map((block) => {
      if (isTextBlock(block)) return block.text;
      if (isMediaBlock(block)) return block.caption ?? "";
      return block.title;
    })
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

const CYRILLIC_YO = /ё/g; // ё -> е so queries match regardless of the letter used

const COMBINING_MARKS = /[̀-ͯ]/g; // strip Latin diacritics left by NFKD

/** Lowercases, unifies ё/е, strips Latin diacritics and collapses whitespace. */
export function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(CYRILLIC_YO, "е")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Full haystack for an entry: title + category + every block's text. */
export function buildFaqSearchText(entry: { title: string; category: string; blocks: FaqBlock[] }): string {
  return normalizeSearchValue([entry.title, entry.category, blocksToPlainText(entry.blocks)].filter(Boolean).join(" "));
}

export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeSearchValue(query);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

/**
 * Word-based match: every query term must appear somewhere in the haystack.
 * An empty query matches everything.
 */
export function matchesFaqQuery(searchText: string, query: string): boolean {
  const terms = tokenizeQuery(query);
  if (!terms.length) return true;
  return terms.every((term) => searchText.includes(term));
}
