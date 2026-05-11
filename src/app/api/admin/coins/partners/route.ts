import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { getRequestBaseUrl, normalizePromoCode, normalizeReferralSlug } from "@/lib/affiliate";
import { db } from "@/lib/db";

const partnerSchema = z.object({
  ownerId: z.string().min(1),
  promoCode: z.string().min(2).max(32),
  discountPercent: z.coerce.number().int().min(0).max(100),
  activationLimit: z.coerce.number().int().min(0).max(1_000_000),
  partnerPercent: z.coerce.number().int().min(0).max(100),
});

export async function POST(request: Request) {
  await requirePermission("coins.manage");

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const parsed = partnerSchema.safeParse({
    ownerId: formData.get("ownerId"),
    promoCode: formData.get("promoCode"),
    discountPercent: formData.get("discountPercent"),
    activationLimit: formData.get("activationLimit"),
    partnerPercent: formData.get("partnerPercent"),
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", "Проверьте поля партнёрской программы.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const promoCode = normalizePromoCode(parsed.data.promoCode);
  const referralSlug = normalizeReferralSlug(promoCode);

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
        ? "Промокод уже используется."
        : "Не удалось создать партнёрскую программу.",
    );
  }

  return NextResponse.redirect(redirectUrl, 303);
}
