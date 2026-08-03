const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatShopMoney(amountMinor: number, currency = "RUB") {
  const formatter = currencyFormatters.get(currency) ?? new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  currencyFormatters.set(currency, formatter);
  return formatter.format(amountMinor / 100);
}

export function parseShopMoneyToMinor(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  const match = normalized.match(/^(\d{1,9})(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Введите корректную сумму с точностью не больше двух знаков.");
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error("Сумма слишком велика.");
  return minor;
}

export function formatFulfillmentTime(minutes: number) {
  if (minutes < 60) return `до ${minutes} мин`;
  const hours = Math.ceil(minutes / 60);
  return `до ${hours} ч`;
}

export const shopOrderStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Ожидает оплаты",
  PAID: "Оплачен",
  WAITING_SELLER: "Ожидает продавца",
  ACCEPTED: "Принят продавцом",
  IN_PROGRESS: "Выполняется",
  SELLER_COMPLETED: "Отмечен выполненным",
  WAITING_BUYER_CONFIRMATION: "Ожидает проверки",
  COMPLETED: "Завершён",
  DISPUTE: "Открыт спор",
  CANCELLED: "Отменён",
  REFUND_PENDING: "Ожидает возврата",
  REFUNDED: "Средства возвращены",
  EXPIRED: "Истёк",
};
