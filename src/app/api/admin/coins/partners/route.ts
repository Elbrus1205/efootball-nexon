import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { normalizePromoCode, normalizeReferralSlug } from "@/lib/affiliate";
import { db } from "@/lib/db";

const partnerSchema = z.object({
  ownerId: z.string().min(1),
  promoCode: z.string().min(2).max(32),
  discountPercent: z.coerce.number().int().min(0).max(100),
  activationLimit: z.coerce.number().int().min(0).max(1_000_000),
  partnerPercent: z.coerce.number().int().min(0).max(100),
  referralSlug: z.string().min(2).max(160),
});

export async function POST(request: Request) {
  await requireRole([UserRole.ADMIN]);

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", request.url);
  const parsed = partnerSchema.safeParse({
    ownerId: formData.get("ownerId"),
    promoCode: formData.get("promoCode"),
    discountPercent: formData.get("discountPercent"),
    activationLimit: formData.get("activationLimit"),
    partnerPercent: formData.get("partnerPercent"),
    referralSlug: formData.get("referralSlug"),
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", "Проверьте поля партнёрской программы.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const promoCode = normalizePromoCode(parsed.data.promoCode);
  const referralSlug = normalizeReferralSlug(parsed.data.referralSlug);

  if (!referralSlug) {
    redirectUrl.searchParams.set("error", "Укажите корректную реферальную ссылку или slug.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await db.affiliatePartner.create({
      data: {
        ownerId: parsed.data.ownerId,
        promoCode,
        discountPercent: parsed.data.discountPercent,
        activationLimit: parsed.data.activationLimit,
        partnerPercent: parsed.data.partnerPercent,
        referralSlug,
      },
    });

    redirectUrl.searchParams.set("created", "1");
  } catch (error) {
    redirectUrl.searchParams.set(
      "error",
      error instanceof Error && error.message.includes("Unique")
        ? "Промокод или реферальная ссылка уже используются."
        : "Не удалось создать партнёрскую программу.",
    );
  }

  return NextResponse.redirect(redirectUrl, 303);
}
