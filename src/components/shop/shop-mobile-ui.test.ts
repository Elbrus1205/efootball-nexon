import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const filters = readFileSync(new URL("./catalog-filters.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("./product-card.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./shop.module.css", import.meta.url), "utf8");
const shopPage = readFileSync(new URL("../../app/shop/page.tsx", import.meta.url), "utf8");
const productPage = readFileSync(new URL("../../app/shop/[slug]/page.tsx", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../../../next.config.mjs", import.meta.url), "utf8");

test("mobile catalog filters render at the document level and stay connected to the GET form", () => {
  assert.match(filters, /createPortal/);
  assert.match(filters, /SHOP_CATALOG_FORM_ID/);
  assert.match(shopPage, /id=\{SHOP_CATALOG_FORM_ID\}/);
  assert.match(filters, /form=\{SHOP_CATALOG_FORM_ID\}/);
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
