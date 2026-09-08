import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/home.module.css", import.meta.url), "utf8");
const admin = readFileSync(new URL("../../app/admin/shop/page.tsx", import.meta.url), "utf8");

test("home no longer renders the community review block", () => {
  assert.doesNotMatch(page, /reviewsTelegramUrl/);
  assert.doesNotMatch(page, /shopReview\.findMany/);
  assert.doesNotMatch(page, /className=\{s\.reviewPanel\}/);
  assert.match(css, /\.reviewPanel\s*\{/);
});

test("review Telegram setting remains editable in admin", () => {
  assert.match(admin, /name="reviewsTelegramUrl"/);
});
