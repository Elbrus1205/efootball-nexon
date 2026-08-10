import { ShopError } from "@/lib/shop/errors";
import type { PaymentProvider } from "@/lib/shop/payments";
import { createPlategaProvider, getPlategaReadiness } from "@/lib/shop/platega-provider";

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.SHOP_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (!provider) {
    throw new ShopError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "Payment is temporarily unavailable: payment provider is not configured.",
      503,
    );
  }

  if (provider === "platega") return createPlategaProvider();

  throw new ShopError("PAYMENT_PROVIDER_UNKNOWN", `Unknown payment provider: ${provider}.`, 500);
}

export function getPaymentReadiness() {
  const provider = process.env.SHOP_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (provider === "platega") {
    const readiness = getPlategaReadiness();
    return {
      configured: readiness.configured,
      provider,
      reason: readiness.reason ?? "Platega is configured.",
    };
  }

  return {
    configured: false,
    provider: provider || "platega",
    reason: provider ? `Unknown payment provider: ${provider}.` : "Payment provider is not configured.",
  };
}
