import assert from "node:assert/strict";
import test from "node:test";
import { faqCategoryOrderSchema, matchesFaqCategories, orderFaqCategories, orderFaqItems, parseFaqCategoryOrder } from "./category-order";

test("section ordering ignores question positions and keeps their relative order", () => {
  const items = [{ id: "a1", category: "A" }, { id: "b1", category: "B" }, { id: "a2", category: "A" }];
  assert.deepEqual(orderFaqItems(items, ["B", "A"]).map((item) => item.id), ["b1", "a1", "a2"]);
  assert.deepEqual(items.map((item) => item.id), ["a1", "b1", "a2"]);
});

test("unconfigured categories follow saved categories deterministically, missing sections stay hidden", () => {
  assert.deepEqual(orderFaqCategories(["Я", "Б", "А", "Б"], ["Hidden", "Б"]), ["Б", "А", "Я"]);
  assert.deepEqual(orderFaqCategories(["А", "Б", "Я"], ["Hidden", "Б"]), ["Б", "А", "Я"]);
  assert.deepEqual(orderFaqCategories(["Hidden", "Б"], ["Hidden", "Б"]), ["Hidden", "Б"]);
});

test("invalid stored settings fall back safely and duplicate input is rejected", () => {
  for (const value of [null, "{", "null", '[1]', '["A","A"]']) assert.deepEqual(parseFaqCategoryOrder(value), []);
  assert.deepEqual(parseFaqCategoryOrder('["B","A"]'), ["B", "A"]);
  assert.equal(faqCategoryOrderSchema.safeParse(["A", "A"]).success, false);
  assert.equal(faqCategoryOrderSchema.safeParse([""]).success, false);
});

test("saving requires all current categories including draft-only sections", () => {
  assert.equal(matchesFaqCategories(["B", "A"], ["A", "B"]), true);
  assert.equal(matchesFaqCategories(["A"], ["A", "Draft"]), false);
  assert.equal(matchesFaqCategories(["A", "Unknown"], ["A", "B"]), false);
  assert.equal(matchesFaqCategories(["A", "A"], ["A", "B"]), false);
  assert.equal(matchesFaqCategories([], []), true);
});
