import assert from "node:assert/strict";
import test from "node:test";
import { FaqAttachmentKind } from "@prisma/client";
import {
  answerToBlocks,
  attachmentsToBlocks,
  blocksToPlainText,
  buildFaqSearchText,
  matchesFaqQuery,
  normalizeFaqBlocks,
  normalizeSearchValue,
  parseFaqBlocks,
  resolveFaqBlocks,
  stringifyFaqBlocks,
  tokenizeQuery,
  type FaqBlock,
} from "@/lib/faq/content";

test("normalizeFaqBlocks keeps valid blocks and drops empty or unknown ones", () => {
  const input = [
    { type: "heading", text: "  Заголовок  " },
    { type: "text", text: "" },
    { type: "note", text: "Важно" },
    { type: "image", url: "https://cdn/img.png", caption: " Подпись " },
    { type: "image", url: "" },
    { type: "video", url: "https://cdn/clip.mp4" },
    { type: "file", url: "https://cdn/reg.pdf", title: "Регламент" },
    { type: "link", url: "https://ex.com" },
    { type: "bogus", text: "nope" },
    "garbage",
  ];

  const blocks = normalizeFaqBlocks(input);

  assert.deepEqual(blocks, [
    { type: "heading", text: "Заголовок" },
    { type: "note", text: "Важно" },
    { type: "image", url: "https://cdn/img.png", caption: "Подпись" },
    { type: "video", url: "https://cdn/clip.mp4" },
    { type: "file", url: "https://cdn/reg.pdf", title: "Регламент" },
    { type: "link", url: "https://ex.com", title: "https://ex.com" },
  ]);
});

test("parse and stringify round-trip preserves normalized blocks", () => {
  const blocks: FaqBlock[] = [
    { type: "text", text: "Ответ" },
    { type: "image", url: "https://cdn/a.png", caption: "Скриншот" },
  ];
  assert.deepEqual(parseFaqBlocks(stringifyFaqBlocks(blocks)), blocks);
  assert.deepEqual(parseFaqBlocks(""), []);
  assert.deepEqual(parseFaqBlocks("not json"), []);
});

test("legacy answer converts to paragraph text blocks", () => {
  const blocks = answerToBlocks("Первый абзац.\n\nВторой абзац.\n\n\n  ");
  assert.deepEqual(blocks, [
    { type: "text", text: "Первый абзац." },
    { type: "text", text: "Второй абзац." },
  ]);
});

test("legacy attachments convert to media and attachment blocks", () => {
  const blocks = attachmentsToBlocks([
    { title: "Скрин", url: "https://cdn/s.png", kind: FaqAttachmentKind.IMAGE, mimeType: "image/png" },
    { title: "Ролик", url: "https://cdn/v.mp4", kind: FaqAttachmentKind.VIDEO },
    { title: "PDF", url: "https://cdn/d.pdf", kind: FaqAttachmentKind.FILE },
    { title: "Сайт", url: "https://ex.com", kind: FaqAttachmentKind.LINK },
  ]);

  assert.equal(blocks[0].type, "image");
  assert.equal(blocks[1].type, "video");
  assert.equal(blocks[2].type, "file");
  assert.equal(blocks[3].type, "link");
});

test("resolveFaqBlocks prefers structured content, falls back to legacy answer + attachments", () => {
  const structured = resolveFaqBlocks({
    contentJson: JSON.stringify([{ type: "text", text: "Новый ответ" }]),
    answer: "старый",
  });
  assert.deepEqual(structured, [{ type: "text", text: "Новый ответ" }]);

  const legacy = resolveFaqBlocks({
    contentJson: null,
    answer: "Абзац один.\n\nАбзац два.",
    attachments: [{ title: "Файл", url: "https://cdn/f.pdf", kind: FaqAttachmentKind.FILE }],
  });
  assert.equal(legacy.length, 3);
  assert.equal(legacy[0].type, "text");
  assert.equal(legacy[2].type, "file");
});

test("blocksToPlainText collects text, captions and titles", () => {
  const text = blocksToPlainText([
    { type: "heading", text: "Заголовок" },
    { type: "text", text: "Абзац" },
    { type: "image", url: "https://cdn/i.png", caption: "Подпись фото" },
    { type: "link", url: "https://ex.com", title: "Ссылка" },
  ]);
  assert.match(text, /Заголовок/);
  assert.match(text, /Подпись фото/);
  assert.match(text, /Ссылка/);
});

test("search normalization unifies ё/е and case", () => {
  assert.equal(normalizeSearchValue("НадЁжность"), "надежность");
  assert.deepEqual(tokenizeQuery("  привязать   Telegram "), ["привязать", "telegram"]);
});

test("word search matches across title and answer text, all terms required", () => {
  const searchText = buildFaqSearchText({
    title: "Как привязать Telegram",
    category: "Безопасность аккаунта",
    blocks: [{ type: "text", text: "Откройте настройки безопасности и подтвердите привязку бота." }],
  });

  assert.ok(matchesFaqQuery(searchText, ""));
  assert.ok(matchesFaqQuery(searchText, "telegram"));
  assert.ok(matchesFaqQuery(searchText, "привязать бота"));
  assert.ok(matchesFaqQuery(searchText, "безопасность"));
  assert.ok(!matchesFaqQuery(searchText, "telegram рейтинг"));
  assert.ok(!matchesFaqQuery(searchText, "почта"));
});
