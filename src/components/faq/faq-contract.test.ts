import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const searchSource = readFileSync(new URL("./faq-search.tsx", import.meta.url), "utf8");
const blocksSource = readFileSync(new URL("./faq-blocks.tsx", import.meta.url), "utf8");
const editorSource = readFileSync(new URL("../admin/faq-block-editor.tsx", import.meta.url), "utf8");
const formSource = readFileSync(new URL("../admin/faq-item-form.tsx", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../app/api/admin/faq/route.ts", import.meta.url), "utf8");
const publicPageSource = readFileSync(new URL("../../app/faq/page.tsx", import.meta.url), "utf8");

test("public FAQ search offers accessible search input, category filter and empty state", () => {
  assert.match(searchSource, /type="search"/);
  assert.match(searchSource, /aria-label="Поиск по FAQ"/);
  assert.match(searchSource, /matchesFaqQuery/);
  assert.match(searchSource, /aria-pressed=\{active\}/);
  assert.match(searchSource, /Ничего не найдено/);
  assert.match(searchSource, /useDeferredValue/);
});

test("block renderer covers every block type with captioned media", () => {
  for (const token of ["heading", "note", "text", "isMediaBlock", "isAttachmentBlock", "figcaption", "loading=\"lazy\""]) {
    assert.ok(blocksSource.includes(token), `block renderer missing: ${token}`);
  }
});

test("admin block editor supports unlimited reorderable blocks with captions and uploads", () => {
  assert.match(editorSource, /moveBlock/);
  assert.match(editorSource, /label="Удалить блок"/);
  assert.match(editorSource, /aria-label=\{label\}/);
  assert.match(editorSource, /Подпись снизу/);
  assert.match(editorSource, /uploadFile\(file, "faq"\)/);
  for (const type of ["heading", "text", "note", "image", "video", "file", "link"]) {
    assert.ok(editorSource.includes(`"${type}"`), `palette missing block type: ${type}`);
  }
});

test("admin form submits structured content and publish state to the API", () => {
  assert.match(formSource, /name="contentJson"/);
  assert.match(formSource, /name="isPublished"/);
  assert.match(formSource, /FaqBlockEditor/);
});

test("API route validates blocks, derives searchable answer and clears legacy attachments", () => {
  assert.match(routeSource, /blocksToPlainText/);
  assert.match(routeSource, /stringifyFaqBlocks/);
  assert.match(routeSource, /Добавьте хотя бы один содержательный блок/);
  assert.match(routeSource, /faqAttachment\.deleteMany/);
  assert.match(routeSource, /revalidatePath\("\/faq"\)/);
});

test("public page builds search entries and stays incrementally cached", () => {
  assert.match(publicPageSource, /export const revalidate/);
  assert.match(publicPageSource, /buildFaqSearchText/);
  assert.match(publicPageSource, /resolveFaqBlocks/);
  assert.match(publicPageSource, /<FaqSearch entries=\{entries\}/);
});
