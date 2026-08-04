import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/home.module.css", import.meta.url), "utf8");
const admin = readFileSync(new URL("../../app/admin/shop/page.tsx", import.meta.url), "utf8");

test("главная выводит настоящие отзывы и ведёт в настроенный Telegram-чат", () => {
  assert.match(page, /reviewsTelegramUrl/);
  assert.match(page, /shopReview\.findMany/);
  assert.match(page, /className=\{s\.reviewBoard\}/);
  assert.match(page, /target="_blank"/);
  assert.match(css, /\.reviewBoard\s*\{/);
  assert.match(css, /\.reviewStream\s*\{/);
});

test("ссылка Telegram-чата отзывов редактируется в настройках магазина", () => {
  assert.match(admin, /name="reviewsTelegramUrl"/);
  assert.match(admin, /Ссылка на чат с отзывами/);
});
