import type { PaymentProvider } from "@/lib/shop/payments";
import { ShopError } from "@/lib/shop/errors";

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.SHOP_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (!provider) {
    throw new ShopError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "Оплата временно недоступна: платёжный провайдер ещё не подключён.",
      503,
    );
  }
  if (provider === "platega") {
    throw new ShopError(
      "PLATEGA_ADAPTER_NOT_CONFIGURED",
      "Адаптер Platega подготовлен к подключению, но реквизиты и контракт провайдера ещё не настроены.",
      503,
    );
  }
  throw new ShopError("PAYMENT_PROVIDER_UNKNOWN", `Неизвестный платёжный провайдер: ${provider}.`, 500);
}

export function getPaymentReadiness() {
  const provider = process.env.SHOP_PAYMENT_PROVIDER?.trim().toLowerCase();
  return {
    configured: false,
    provider: provider || "platega",
    reason: provider === "platega"
      ? "Platega будет доступна после добавления production-адаптера и ключей."
      : "Платёжный провайдер ещё не подключён.",
  };
}
