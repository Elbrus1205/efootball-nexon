import { db } from "@/lib/db";

export const defaultShopSettings = {
  id: "default",
  isEnabled: false,
  maintenanceMode: false,
  showHomeBlock: true,
  currency: "RUB",
  minimumOrderMinor: 1_000,
  maximumOrderMinor: 100_000_000,
  paymentTimeoutMinutes: 15,
  sellerAcceptTimeoutMinutes: 10,
  fulfillmentTimeoutMinutes: 60,
  buyerConfirmTimeoutMinutes: 1_440,
  autoCompleteEnabled: false,
  reviewEditWindowHours: 24,
  reviewModerationEnabled: true,
  reviewImagesEnabled: true,
  cancellationEnabled: true,
  showSellerToBuyer: false,
  defaultCommissionBps: 3_000,
  supportTelegramChatId: null,
  reviewsTelegramChatId: null,
  reviewsTelegramUrl: null,
  supportContact: null,
  termsVersion: "shop-draft-1",
  legalTextsJson: null,
  updatedById: null,
};

export async function getShopSettings() {
  const settings = await db.shopSettings.findUnique({ where: { id: "default" } });
  return settings ?? defaultShopSettings;
}

export function getShopAvailability(settings: Awaited<ReturnType<typeof getShopSettings>>) {
  if (!settings.isEnabled) {
    return { available: false as const, reason: "Магазин пока не открыт. Следите за объявлениями платформы." };
  }
  if (settings.maintenanceMode) {
    return { available: false as const, reason: "В магазине идут технические работы. Попробуйте немного позже." };
  }
  return { available: true as const, reason: null };
}
