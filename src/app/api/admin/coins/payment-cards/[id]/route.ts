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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.FOUNDER]);

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const method = formData.get("_method");

  if (method === "delete") {
    if (formData.get("confirmDelete") !== "on") {
      redirectUrl.searchParams.set("error", "Подтвердите удаление карты оплаты.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    try {
      await db.coinPaymentCard.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      redirectUrl.searchParams.set("paymentCardDeleted", "1");
    } catch {
      redirectUrl.searchParams.set("error", "Не удалось удалить карту оплаты.");
    }

    return NextResponse.redirect(redirectUrl, 303);
  }

  if (method !== "update") {
    redirectUrl.searchParams.set("error", "Некорректное действие с картой оплаты.");
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

  try {
    await db.coinPaymentCard.update({
      where: { id: params.id },
      data: parsed.data,
    });
    redirectUrl.searchParams.set("paymentCardUpdated", "1");
  } catch {
    redirectUrl.searchParams.set("error", "Не удалось обновить карту оплаты.");
  }

  return NextResponse.redirect(redirectUrl, 303);
}

