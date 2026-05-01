import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { DEFAULT_COIN_STORE_SETTINGS_ID } from "@/lib/coin-services";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

const settingsSchema = z.object({
  paymentCard: z.string().max(500).optional(),
  paymentRecipient: z.string().max(300).optional(),
  paymentComment: z.string().max(500).optional(),
  defaultExecutorPercent: z.coerce.number().int().min(0).max(100),
  defaultOwnerPercent: z.coerce.number().int().min(0).max(100),
});

export async function POST(request: Request) {
  await requireRole([UserRole.FOUNDER]);

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const parsed = settingsSchema.safeParse({
    paymentCard: formData.get("paymentCard") ?? "",
    paymentRecipient: formData.get("paymentRecipient") ?? "",
    paymentComment: formData.get("paymentComment") ?? "",
    defaultExecutorPercent: formData.get("defaultExecutorPercent"),
    defaultOwnerPercent: formData.get("defaultOwnerPercent"),
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", "Проверьте настройки магазина.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (parsed.data.defaultExecutorPercent + parsed.data.defaultOwnerPercent > 100) {
    redirectUrl.searchParams.set("error", "Проценты исполнителя и владельца не должны быть больше 100% вместе.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await db.coinStoreSettings.upsert({
    where: { id: DEFAULT_COIN_STORE_SETTINGS_ID },
    create: {
      id: DEFAULT_COIN_STORE_SETTINGS_ID,
      coinsStoreEnabled: formData.get("coinsStoreEnabled") === "on",
      servicesStoreEnabled: formData.get("servicesStoreEnabled") === "on",
      paymentCard: parsed.data.paymentCard?.trim() || null,
      paymentRecipient: parsed.data.paymentRecipient?.trim() || null,
      paymentComment: parsed.data.paymentComment?.trim() || null,
      defaultExecutorPercent: parsed.data.defaultExecutorPercent,
      defaultOwnerPercent: parsed.data.defaultOwnerPercent,
    },
    update: {
      coinsStoreEnabled: formData.get("coinsStoreEnabled") === "on",
      servicesStoreEnabled: formData.get("servicesStoreEnabled") === "on",
      paymentCard: parsed.data.paymentCard?.trim() || null,
      paymentRecipient: parsed.data.paymentRecipient?.trim() || null,
      paymentComment: parsed.data.paymentComment?.trim() || null,
      defaultExecutorPercent: parsed.data.defaultExecutorPercent,
      defaultOwnerPercent: parsed.data.defaultOwnerPercent,
    },
  });

  redirectUrl.searchParams.set("settingsUpdated", "1");
  return NextResponse.redirect(redirectUrl, 303);
}

