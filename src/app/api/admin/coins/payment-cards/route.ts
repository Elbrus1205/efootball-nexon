import { NextResponse } from "next/server";
import { CoinPaymentBank, UserRole } from "@prisma/client";
import { z } from "zod";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

const paymentCardSchema = z.object({
  bank: z.nativeEnum(CoinPaymentBank),
  cardNumber: z.string().trim().min(6).max(120),
  recipient: z.string().trim().min(2).max(200),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
});

export async function POST(request: Request) {
  await requireRole([UserRole.FOUNDER]);

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const activeCards = await db.coinPaymentCard.count({ where: { isActive: true } });

  if (activeCards >= 10) {
    redirectUrl.searchParams.set("error", "Можно добавить максимум 10 активных карт оплаты.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const parsed = paymentCardSchema.safeParse({
    bank: formData.get("bank"),
    cardNumber: formData.get("cardNumber"),
    recipient: formData.get("recipient"),
    sortOrder: formData.get("sortOrder") ?? 0,
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", "Проверьте поля карты оплаты.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await db.coinPaymentCard.create({
    data: parsed.data,
  });

  redirectUrl.searchParams.set("paymentCardCreated", "1");
  return NextResponse.redirect(redirectUrl, 303);
}

