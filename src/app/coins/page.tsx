import type { Metadata } from "next";
import { CoinsShowcase } from "@/components/coins/coins-showcase";
import { PartnerDashboard } from "@/components/coins/partner-dashboard";
import { getCurrentSession } from "@/lib/auth/session";
import { getCoinsProductOffersByPlatform } from "@/lib/coins-products";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Coins | eFootball Nexon",
  description: "Покупка Coins для eFootball Mobile: Android, iOS и акционные наборы в одном каталоге.",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export default async function CoinsPage() {
  const session = await getCurrentSession();
  const partner = session?.user
    ? await db.affiliatePartner.findFirst({
        where: { ownerId: session.user.id },
        include: {
          referrals: true,
          purchases: {
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              referrals: true,
              purchases: true,
            },
          },
        },
      })
    : null;

  const partnerTurnover = partner?.purchases.reduce((sum, purchase) => sum + purchase.paidAmountKopecks, 0) ?? 0;
  const partnerProfit = partner?.purchases.reduce((sum, purchase) => sum + purchase.profitKopecks, 0) ?? 0;
  const partnerEarning = partner?.purchases.reduce((sum, purchase) => sum + purchase.partnerEarningKopecks, 0) ?? 0;
  const offersByPlatform = await getCoinsProductOffersByPlatform();

  return (
    <main className="page-shell space-y-6 py-0 pb-12 sm:pb-16">
      {partner ? (
        <PartnerDashboard
          promoCode={partner.promoCode}
          discountPercent={partner.discountPercent}
          partnerPercent={partner.partnerPercent}
          stats={{
            referrals: partner._count.referrals,
            purchases: partner._count.purchases,
            turnover: formatMoney(partnerTurnover),
            profit: formatMoney(partnerProfit),
            earning: formatMoney(partnerEarning),
          }}
          referrals={partner.referrals.map((referral) => referral.displayName || referral.contact || referral.referralKey)}
          purchases={partner.purchases.map((purchase) => ({
            id: purchase.id,
            title: purchase.offerTitle,
            amount: formatMoney(purchase.paidAmountKopecks),
            earning: formatMoney(purchase.partnerEarningKopecks),
          }))}
        />
      ) : null}
      <CoinsShowcase offersByPlatform={offersByPlatform} />
    </main>
  );
}
