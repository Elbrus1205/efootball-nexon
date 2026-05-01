import type { CoinServiceOrderStatus } from "@prisma/client";
import { db } from "@/lib/db";

export const DEFAULT_COIN_STORE_SETTINGS_ID = "default";

export const defaultCoinStoreSettings = {
  id: DEFAULT_COIN_STORE_SETTINGS_ID,
  coinsStoreEnabled: true,
  servicesStoreEnabled: true,
  paymentCard: "",
  paymentRecipient: "",
  paymentComment: "",
  defaultExecutorPercent: 70,
  defaultOwnerPercent: 30,
};

export async function getCoinStoreSettings() {
  const settings = await db.coinStoreSettings.findUnique({
    where: { id: DEFAULT_COIN_STORE_SETTINGS_ID },
  });

  return {
    ...defaultCoinStoreSettings,
    ...settings,
    paymentCard: settings?.paymentCard ?? "",
    paymentRecipient: settings?.paymentRecipient ?? "",
    paymentComment: settings?.paymentComment ?? "",
  };
}

export function formatKopecks(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function calculatePercentAmount(totalKopecks: number, percent: number) {
  return Math.round((totalKopecks * percent) / 100);
}

export function serviceOrderStatusLabel(status: CoinServiceOrderStatus) {
  switch (status) {
    case "PENDING_REVIEW":
      return "Ждёт принятия";
    case "ACCEPTED":
      return "В работе";
    case "EXECUTOR_DONE":
      return "Исполнитель завершил";
    case "COMPLETED":
      return "Завершён";
    case "REJECTED":
      return "Отклонён";
    default:
      return status;
  }
}

export function serviceOrderStatusTone(status: CoinServiceOrderStatus) {
  switch (status) {
    case "PENDING_REVIEW":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    case "ACCEPTED":
      return "border-sky-300/25 bg-sky-400/10 text-sky-100";
    case "EXECUTOR_DONE":
      return "border-violet-300/25 bg-violet-400/10 text-violet-100";
    case "COMPLETED":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    case "REJECTED":
      return "border-rose-300/25 bg-rose-400/10 text-rose-100";
    default:
      return "border-white/10 bg-white/[0.04] text-zinc-300";
  }
}

