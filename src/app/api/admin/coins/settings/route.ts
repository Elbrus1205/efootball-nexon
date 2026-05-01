import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { DEFAULT_COIN_STORE_SETTINGS_ID } from "@/lib/coin-services";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

const settingsSchema = z.object({
  paymentComment: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  await requireRole([UserRole.FOUNDER]);

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const parsed = settingsSchema.safeParse({
    paymentComment: formData.get("paymentComment") ?? "",
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", "Проверьте настройки магазина.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await db.coinStoreSettings.upsert({
    where: { id: DEFAULT_COIN_STORE_SETTINGS_ID },
    create: {
      id: DEFAULT_COIN_STORE_SETTINGS_ID,
      coinsStoreEnabled: formData.get("coinsStoreEnabled") === "on",
      servicesStoreEnabled: formData.get("servicesStoreEnabled") === "on",
      paymentComment: parsed.data.paymentComment?.trim() || null,
    },
    update: {
      coinsStoreEnabled: formData.get("coinsStoreEnabled") === "on",
      servicesStoreEnabled: formData.get("servicesStoreEnabled") === "on",
      paymentComment: parsed.data.paymentComment?.trim() || null,
    },
  });

  redirectUrl.searchParams.set("settingsUpdated", "1");
  return NextResponse.redirect(redirectUrl, 303);
}
