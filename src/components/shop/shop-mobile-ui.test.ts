import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const card = readFileSync(new URL("./product-card.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./shop.module.css", import.meta.url), "utf8");
const shopPage = readFileSync(new URL("../../app/shop/page.tsx", import.meta.url), "utf8");
const productPage = readFileSync(new URL("../../app/shop/[slug]/page.tsx", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../../../next.config.mjs", import.meta.url), "utf8");

test("shop catalog has no search or filter controls and reviews open Telegram", () => {
  assert.doesNotMatch(shopPage, /CatalogFilters|type="search"|name="sort"|shop-catalog-form/);
  assert.match(shopPage, /settings\.reviewsTelegramUrl/);
  assert.match(shopPage, /Наши отзывы/);
  assert.match(shopPage, /shopHeaderAction/);
  assert.match(css, /@keyframes shop-action-sheen/);
});

test("product cards use a generated background and product details omit photos", () => {
  assert.match(card, /productCardBackdrop/);
  assert.doesNotMatch(card, /next\/image|<Image/);
  assert.match(css, /\.productCardBackdrop\s*\{/);
  assert.match(css, /\.productCardScrim\s*\{/);
  assert.doesNotMatch(productPage, /product\.images\.map|galleryMain/);
});

test("catalog product action says buy and product details omit FAQ", () => {
  assert.match(card, />Купить</);
  assert.doesNotMatch(card, /Подробнее/);
  assert.doesNotMatch(productPage, /Частые вопросы|faqJson/);
});

test("mobile catalog keeps two compact products in each row", () => {
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*?\.grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.productImage \{ height: 66px; min-height: 0;/);
});

test("legacy Postimg product photos are accepted by the Next image loader", () => {
  assert.match(nextConfig, /hostname:\s*["']i\.postimg\.cc["']/);
});
