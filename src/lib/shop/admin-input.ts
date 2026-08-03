export type ShopStockInput = { unlimited: boolean; stockQuantity: string };

export function parseShopStockInput(input: ShopStockInput) {
  if (input.unlimited) return { stockMode: "UNLIMITED" as const, stockQuantity: 0 };
  if (!/^\d+$/.test(input.stockQuantity.trim())) throw new Error("Остаток должен быть целым неотрицательным числом.");
  const stockQuantity = Number.parseInt(input.stockQuantity, 10);
  if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0) throw new Error("Остаток должен быть целым неотрицательным числом.");
  return { stockMode: "FINITE" as const, stockQuantity };
}

export function parseCommissionPercent(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized)) throw new Error("Комиссия должна быть числом от 0 до 100 процентов.");
  const percent = Number(normalized);
  if (percent < 0 || percent > 100) throw new Error("Комиссия должна быть числом от 0 до 100 процентов.");
  return Math.round(percent * 100);
}
