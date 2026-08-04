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

test("product photos cover catalog cards and remain visible on the product page", () => {
  assert.match(card, /productCardBackdrop/);
  assert.match(css, /\.productCardBackdrop\s*\{/);
  assert.match(css, /\.productCardScrim\s*\{/);
  assert.match(productPage, /product\.images\.map/);
});

test("legacy Postimg product photos are accepted by the Next image loader", () => {
  assert.match(nextConfig, /hostname:\s*["']i\.postimg\.cc["']/);
});
