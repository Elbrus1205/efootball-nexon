export type ShopPromoCodeQuote = {
  kind: "PERCENT" | "FIXED";
  value: number;
  minimumSubtotalMinor?: number | null;
  maximumDiscountMinor?: number | null;
};

export type ShopQuoteInput = {
  unitPriceMinor: number;
  salePriceMinor?: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
  quantity: number;
  promoCode?: ShopPromoCodeQuote | null;
};

export type ShopQuote = {
  baseUnitPriceMinor: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  promotionDiscountMinor: number;
  promoCodeDiscountMinor: number;
  totalMinor: number;
};

function assertMinorUnits(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} должен быть целым неотрицательным значением в минимальных единицах валюты.`);
  }
}

function isSaleActive(input: ShopQuoteInput, now: Date) {
  if (input.salePriceMinor === null || input.salePriceMinor === undefined) return false;
  if (input.salePriceMinor >= input.unitPriceMinor) return false;
  if (input.saleStartsAt && input.saleStartsAt.getTime() > now.getTime()) return false;
  if (input.saleEndsAt && input.saleEndsAt.getTime() <= now.getTime()) return false;
  return true;
}

export function calculateShopQuote(input: ShopQuoteInput, now = new Date()): ShopQuote {
  assertMinorUnits(input.unitPriceMinor, "Цена");
  if (input.salePriceMinor !== null && input.salePriceMinor !== undefined) {
    assertMinorUnits(input.salePriceMinor, "Акционная цена");
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 99) {
    throw new Error("Количество должно быть целым числом от 1 до 99.");
  }

  const unitPriceMinor = isSaleActive(input, now) ? input.salePriceMinor! : input.unitPriceMinor;
  const baseSubtotalMinor = input.unitPriceMinor * input.quantity;
  const subtotalMinor = unitPriceMinor * input.quantity;
  assertMinorUnits(baseSubtotalMinor, "Базовая сумма");
  assertMinorUnits(subtotalMinor, "Сумма");

  let promoCodeDiscountMinor = 0;
  const promo = input.promoCode;
  if (promo && subtotalMinor >= (promo.minimumSubtotalMinor ?? 0)) {
    assertMinorUnits(promo.value, "Значение промокода");
    if (promo.kind === "PERCENT") {
      if (promo.value > 100) throw new Error("Процент промокода не может превышать 100.");
      promoCodeDiscountMinor = Math.floor((subtotalMinor * promo.value) / 100);
    } else {
      promoCodeDiscountMinor = promo.value;
    }

    if (promo.maximumDiscountMinor !== null && promo.maximumDiscountMinor !== undefined) {
      assertMinorUnits(promo.maximumDiscountMinor, "Максимальная скидка");
      promoCodeDiscountMinor = Math.min(promoCodeDiscountMinor, promo.maximumDiscountMinor);
    }
    promoCodeDiscountMinor = Math.min(promoCodeDiscountMinor, subtotalMinor);
  }

  return {
    baseUnitPriceMinor: input.unitPriceMinor,
    unitPriceMinor,
    subtotalMinor,
    promotionDiscountMinor: baseSubtotalMinor - subtotalMinor,
    promoCodeDiscountMinor,
    totalMinor: subtotalMinor - promoCodeDiscountMinor,
  };
}
