import { CoinServiceOrderStatus, type CoinPaymentBank } from "@prisma/client";
import { db } from "@/lib/db";

export const DEFAULT_COIN_STORE_SETTINGS_ID = "default";

export const defaultCoinStoreSettings = {
  id: DEFAULT_COIN_STORE_SETTINGS_ID,
  coinsStoreEnabled: true,
  servicesStoreEnabled: true,
  paymentCard: "",
  paymentRecipient: "",
  paymentComment: "",
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

export const coinPaymentBankOptions = [
  { value: "OZON", label: "Озон Банк" },
  { value: "TBANK", label: "ТБанк" },
  { value: "SBER", label: "Сбербанк" },
  { value: "VTB", label: "ВТБ" },
] satisfies Array<{ value: CoinPaymentBank; label: string }>;

export function coinPaymentBankLabel(bank?: CoinPaymentBank | null) {
  return coinPaymentBankOptions.find((item) => item.value === bank)?.label ?? "Банк";
}

export function coinPaymentBankTone(bank?: CoinPaymentBank | null) {
  switch (bank) {
    case "OZON":
      return "border-primary/35 bg-transparent text-primary";
    case "TBANK":
      return "border-primary/35 bg-transparent text-primary";
    case "SBER":
      return "border-primary/35 bg-transparent text-primary";
    case "VTB":
      return "border-primary/35 bg-transparent text-primary";
    default:
      return "border-white/10 bg-white/[0.06] text-white";
  }
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
      return "Ожидает проверки оплаты";
    case "AWAITING_EXECUTOR":
      return "Ожидает свободного исполнителя";
    case "ASSIGNED":
      return "Ожидает ответа исполнителя";
    case "ACCEPTED":
      return "В работе";
    case "EXECUTOR_DONE":
      return "Ожидает подтверждения";
    case "COMPLETED":
      return "Выполнено";
    case "REJECTED":
      return "Отменено";
    default:
      return status;
  }
}

export function serviceOrderStatusTone(status: CoinServiceOrderStatus) {
  switch (status) {
    case "PENDING_REVIEW":
      return "border-[#9A6A1A]/55 bg-[#9A6A1A]/12 text-[#E5C982]";
    case "AWAITING_EXECUTOR":
      return "border-[#9A6A1A]/55 bg-[#9A6A1A]/12 text-[#E5C982]";
    case "ASSIGNED":
      return "border-primary/35 bg-transparent text-primary";
    case "ACCEPTED":
      return "border-primary/35 bg-transparent text-primary";
    case "EXECUTOR_DONE":
      return "border-primary/35 bg-transparent text-primary";
    case "COMPLETED":
      return "border-[#2F6B47]/55 bg-[#2F6B47]/15 text-[#BFE6CC]";
    case "REJECTED":
      return "border-[#8B3A3A]/60 bg-[#8B3A3A]/15 text-[#E7B9B9]";
    default:
      return "border-white/10 bg-white/[0.04] text-zinc-300";
  }
}

export async function pickFairCoinServiceExecutor(options?: { excludeUserIds?: string[] }) {
  const excludeUserIds = options?.excludeUserIds ?? [];
  const executorProfiles = await db.coinServiceExecutor.findMany({
    where: {
      isActive: true,
      userId: excludeUserIds.length ? { notIn: excludeUserIds } : undefined,
      user: {
        isBanned: false,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!executorProfiles.length) {
    return null;
  }

  const executorIds = executorProfiles.map((profile) => profile.userId);
  const orderCounts = await db.coinServiceOrder.groupBy({
    by: ["executorId"],
    where: {
      executorId: { in: executorIds },
      status: { not: CoinServiceOrderStatus.REJECTED },
    },
    _count: { _all: true },
  });
  const countByExecutorId = new Map(orderCounts.map((item) => [item.executorId, item._count._all]));
  const leastAssignedCount = Math.min(...executorIds.map((id) => countByExecutorId.get(id) ?? 0));
  const candidates = executorProfiles.filter((profile) => (countByExecutorId.get(profile.userId) ?? 0) === leastAssignedCount);

  return candidates[0]?.user ?? null;
}

export async function assignNextCoinServiceExecutor(orderId: string) {
  const previousAttempts = await db.coinServiceExecutorAttempt.findMany({
    where: { orderId },
    select: { executorId: true },
    orderBy: { createdAt: "asc" },
  });
  const executor = await pickFairCoinServiceExecutor({
    excludeUserIds: previousAttempts.map((attempt) => attempt.executorId),
  });

  if (!executor) {
    await db.coinServiceOrder.update({
      where: { id: orderId },
      data: {
        executorId: null,
        status: CoinServiceOrderStatus.AWAITING_EXECUTOR,
      },
    });
    return null;
  }

  await db.coinServiceExecutorAttempt.create({
    data: {
      orderId,
      executorId: executor.id,
      status: "ASSIGNED",
    },
  });

  await db.coinServiceOrder.update({
    where: { id: orderId },
    data: {
      executorId: executor.id,
      status: CoinServiceOrderStatus.ASSIGNED,
    },
  });

  return executor;
}

