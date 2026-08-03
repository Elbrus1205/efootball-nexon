import assert from "node:assert/strict";
import test from "node:test";

import { parseCommissionPercent, parseShopStockInput } from "./admin-input";

test("неограниченный остаток не сохраняет случайно введённое количество", () => {
  assert.deepEqual(parseShopStockInput({ unlimited: true, stockQuantity: "999" }), {
    stockMode: "UNLIMITED",
    stockQuantity: 0,
  });
});

test("комиссия в понятных процентах переводится в basis points", () => {
  assert.equal(parseCommissionPercent("30"), 3000);
  assert.equal(parseCommissionPercent("12.5"), 1250);
  assert.throws(() => parseCommissionPercent("101"), /комисси/i);
});

test("ограниченный остаток принимает только неотрицательное целое количество", () => {
  assert.deepEqual(parseShopStockInput({ unlimited: false, stockQuantity: "24" }), {
    stockMode: "FINITE",
    stockQuantity: 24,
  });
  assert.throws(() => parseShopStockInput({ unlimited: false, stockQuantity: "-1" }), /остаток/i);
});
