import { NextResponse } from "next/server";
import { AffiliatePurchaseSource } from "@prisma/client";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { normalizePromoCode } from "@/lib/affiliate";
import { getCoinsProductOffer } from "@/lib/coins-products";
import { db } from "@/lib/db";

const orderSchema = z.object({
  offerId: z.string().min(1),
  platform: z.enum(["android", "ios", "promo"]),
  playerName: z.string().min(2).max(120),
  contact: z.string().min(3).max(200),
  promoCode: z.string().max(32).optional(),
});

export async function POST(request: Request) {
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте данные заказа." }, { status: 400 });
  }

  const offer = await getCoinsProductOffer(parsed.data.platform, parsed.data.offerId);

  if (!offer) {
    return NextResponse.json({ error: "Пакет Coins не найден." }, { status: 404 });
  }

  const session = await getCurrentSession();
  const promoCode = parsed.data.promoCode ? normalizePromoCode(parsed.data.promoCode) : "";

  if (promoCode && !session?.user?.id) {
    return NextResponse.json({ error: "Войдите в аккаунт, чтобы активировать партнёрский промокод." }, { status: 401 });
  }

  const existingReferral = session?.user?.id
    ? await db.affiliateReferral.findFirst({
        where: { userId: session.user.id },
        include: {
          partner: {
            select: {
              id: true,
              promoCode: true,
              discountPercent: true,
              activationLimit: true,
              partnerPercent: true,
              isActive: true,
            },
          },
        },
      })
    : null;

  if (promoCode && existingReferral) {
    return NextResponse.json({ error: "На этом аккаунте уже активирован партнёрский промокод." }, { status: 400 });
  }

  const activatedPartner = promoCode
    ? await db.affiliatePartner.findFirst({
        where: { promoCode, isActive: true },
        select: {
          id: true,
          promoCode: true,
          discountPercent: true,
          activationLimit: true,
          partnerPercent: true,
          isActive: true,
          _count: { select: { referrals: true } },
        },
      })
    : null;

  if (promoCode && !activatedPartner) {
    return NextResponse.json({ error: "Промокод не найден или отключён." }, { status: 404 });
  }

  if (activatedPartner && activatedPartner.activationLimit > 0 && activatedPartner._count.referrals >= activatedPartner.activationLimit) {
    return NextResponse.json({ error: "Лимит активаций промокода закончился." }, { status: 400 });
  }

  const partner = activatedPartner ?? (existingReferral?.partner?.isActive ? existingReferral.partner : null);
  const salePriceKopecks = offer.priceKopecks;
  const discountKopecks = activatedPartner ? Math.round((salePriceKopecks * activatedPartner.discountPercent) / 100) : 0;
  const paidAmountKopecks = Math.max(0, salePriceKopecks - discountKopecks);
  const costKopecks = offer.costKopecks ?? 0;
  const profitKopecks = Math.max(0, paidAmountKopecks - costKopecks);
  const partnerEarningKopecks = partner ? Math.round((profitKopecks * partner.partnerPercent) / 100) : 0;

  if (partner) {
    await db.$transaction(async (tx) => {
      const referral =
        existingReferral ??
        (await tx.affiliateReferral.create({
          data: {
            partnerId: partner.id,
            referralKey: `user:${session!.user.id}`,
            userId: session!.user.id,
            displayName: parsed.data.playerName.trim(),
            contact: parsed.data.contact.trim(),
          },
        }));

      await tx.affiliatePurchase.create({
        data: {
          partnerId: partner.id,
          referralId: referral.id,
          buyerUserId: session?.user?.id,
          buyerName: parsed.data.playerName.trim(),
          buyerContact: parsed.data.contact.trim(),
          source: AffiliatePurchaseSource.PROMO_CODE,
          promoCode: activatedPartner?.promoCode ?? null,
          platform: parsed.data.platform,
          offerId: offer.id,
          offerTitle: offer.title,
          salePriceKopecks,
          discountKopecks,
          paidAmountKopecks,
          costKopecks,
          profitKopecks,
          partnerEarningKopecks,
        },
      });
    });
  }

  return NextResponse.json({
    ok: true,
    paidAmountKopecks,
    discountKopecks,
    affiliateApplied: Boolean(partner),
  });
}
