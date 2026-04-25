import { NextResponse } from "next/server";
import { AffiliatePurchaseSource } from "@prisma/client";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { getAffiliateRefCookie, normalizePromoCode } from "@/lib/affiliate";
import { getCoinsOffer, getCoinsOfferCostKopecks } from "@/lib/coins-catalog";
import { db } from "@/lib/db";

const orderSchema = z.object({
  offerId: z.string().min(1),
  platform: z.enum(["android", "ios", "promo"]),
  playerName: z.string().min(2).max(120),
  contact: z.string().min(3).max(200),
  promoCode: z.string().max(32).optional(),
});

function buildReferralKey(userId: string | undefined, contact: string) {
  return userId ? `user:${userId}` : `contact:${contact.trim().toLowerCase()}`;
}

export async function POST(request: Request) {
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте данные заказа." }, { status: 400 });
  }

  const offer = getCoinsOffer(parsed.data.platform, parsed.data.offerId);

  if (!offer) {
    return NextResponse.json({ error: "Пакет Coins не найден." }, { status: 404 });
  }

  const session = await getCurrentSession();
  const promoCode = parsed.data.promoCode ? normalizePromoCode(parsed.data.promoCode) : "";
  const referralSlug = getAffiliateRefCookie();

  const partner = promoCode
    ? await db.affiliatePartner.findFirst({
        where: { promoCode, isActive: true },
        select: {
          id: true,
          promoCode: true,
          discountPercent: true,
          activationLimit: true,
          partnerPercent: true,
          _count: { select: { purchases: { where: { source: AffiliatePurchaseSource.PROMO_CODE } } } },
        },
      })
    : referralSlug
      ? await db.affiliatePartner.findFirst({
          where: { referralSlug, isActive: true },
          select: {
            id: true,
            promoCode: true,
            discountPercent: true,
            activationLimit: true,
            partnerPercent: true,
            _count: { select: { purchases: { where: { source: AffiliatePurchaseSource.PROMO_CODE } } } },
          },
        })
      : null;

  if (promoCode && !partner) {
    return NextResponse.json({ error: "Промокод не найден или отключён." }, { status: 404 });
  }

  if (partner && promoCode && partner.activationLimit > 0 && partner._count.purchases >= partner.activationLimit) {
    return NextResponse.json({ error: "Лимит активаций промокода закончился." }, { status: 400 });
  }

  const salePriceKopecks = offer.priceKopecks;
  const discountKopecks = partner && promoCode ? Math.round((salePriceKopecks * partner.discountPercent) / 100) : 0;
  const paidAmountKopecks = Math.max(0, salePriceKopecks - discountKopecks);
  const costKopecks = getCoinsOfferCostKopecks(salePriceKopecks);
  const profitKopecks = Math.max(0, paidAmountKopecks - costKopecks);
  const partnerEarningKopecks = partner ? Math.round((profitKopecks * partner.partnerPercent) / 100) : 0;

  if (partner) {
    const referralKey = buildReferralKey(session?.user?.id, parsed.data.contact);
    const source = promoCode ? AffiliatePurchaseSource.PROMO_CODE : AffiliatePurchaseSource.REFERRAL_LINK;

    await db.$transaction(async (tx) => {
      const referral = await tx.affiliateReferral.upsert({
        where: {
          partnerId_referralKey: {
            partnerId: partner.id,
            referralKey,
          },
        },
        update: {
          displayName: parsed.data.playerName.trim(),
          contact: parsed.data.contact.trim(),
          userId: session?.user?.id ?? undefined,
        },
        create: {
          partnerId: partner.id,
          referralKey,
          userId: session?.user?.id,
          displayName: parsed.data.playerName.trim(),
          contact: parsed.data.contact.trim(),
        },
      });

      await tx.affiliatePurchase.create({
        data: {
          partnerId: partner.id,
          referralId: referral.id,
          buyerUserId: session?.user?.id,
          buyerName: parsed.data.playerName.trim(),
          buyerContact: parsed.data.contact.trim(),
          source,
          promoCode: promoCode || null,
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
