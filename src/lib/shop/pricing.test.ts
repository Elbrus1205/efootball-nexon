import assert from "node:assert/strict";
import test from "node:test";

import { calculateShopQuote } from "./pricing";

const noon = new Date("2026-08-03T12:00:00.000Z");

test("покупатель получает серверную цену активной акции", () => {
  const quote = calculateShopQuote({
    unitPriceMinor: 149_000,
    salePriceMinor: 129_000,
    saleStartsAt: new Date("2026-08-01T00:00:00.000Z"),
    saleEndsAt: new Date("2026-08-10T00:00:00.000Z"),
    quantity: 2,
  }, noon);

  assert.deepEqual(quote, {
    baseUnitPriceMinor: 149_000,
    unitPriceMinor: 129_000,
    subtotalMinor: 258_000,
    promotionDiscountMinor: 40_000,
    promoCodeDiscountMinor: 0,
    totalMinor: 258_000,
  });
});

test("завершённая акция не изменяет цену", () => {
  const quote = calculateShopQuote({
    unitPriceMinor: 149_000,
    salePriceMinor: 99_000,
    saleEndsAt: new Date("2026-08-03T11:59:59.000Z"),
    quantity: 1,
  }, noon);

  assert.equal(quote.unitPriceMinor, 149_000);
  assert.equal(quote.totalMinor, 149_000);
  assert.equal(quote.promotionDiscountMinor, 0);
});

test("процентный промокод соблюдает минимальную сумму и максимум скидки", () => {
  const quote = calculateShopQuote({
    unitPriceMinor: 120_000,
    quantity: 3,
    promoCode: {
      kind: "PERCENT",
      value: 20,
      minimumSubtotalMinor: 300_000,
      maximumDiscountMinor: 50_000,
    },
  }, noon);

  assert.equal(quote.subtotalMinor, 360_000);
  assert.equal(quote.promoCodeDiscountMinor, 50_000);
  assert.equal(quote.totalMinor, 310_000);
});

test("денежный расчёт отклоняет нецелые минимальные единицы", () => {
  assert.throws(() => calculateShopQuote({ unitPriceMinor: 1490.5, quantity: 1 }, noon), /целым/);
});
