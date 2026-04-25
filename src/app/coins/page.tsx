import type { Metadata } from "next";
import { Copy, Link2, Percent, Users } from "lucide-react";
import { CoinsShowcase } from "@/components/coins/coins-showcase";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { formatReferralLink } from "@/lib/affiliate";
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
              clicks: true,
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
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://efootball-nexon.ru";
  const referralLink = partner ? formatReferralLink(baseUrl, partner.referralSlug) : "";

  return (
    <main className="page-shell space-y-6 py-0 pb-12 sm:pb-16">
      {partner ? (
        <Card className="overflow-hidden rounded-2xl border-primary/20 bg-[linear-gradient(180deg,rgba(10,16,28,0.96),rgba(5,9,16,0.98))] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Percent className="h-4 w-4 text-primary" />
                Партнёрская панель
              </CardTitle>
              <CardDescription className="mt-1">Промокод, ссылка и статистика.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-semibold text-blue-100">{partner.promoCode}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-zinc-200">{partner.discountPercent}% скидка</span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-zinc-200">{partner.partnerPercent}%</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
            {[
              ["Переходы", partner._count.clicks],
              ["Рефералы", partner._count.referrals],
              ["Покупки", partner._count.purchases],
              ["Оборот", formatMoney(partnerTurnover)],
              ["Заработок", formatMoney(partnerEarning)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">{label}</div>
                <div className="mt-1 text-base font-bold text-white">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{referralLink}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
              <Copy className="h-3.5 w-3.5 text-zinc-500" />
              {partnerProfit ? `Профит: ${formatMoney(partnerProfit)}` : "Покупок пока нет"}
            </div>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
                <Users className="h-3.5 w-3.5 text-primary" />
                Рефералы
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {partner.referrals.slice(0, 4).map((referral) => (
                  <div key={referral.id} className="truncate rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300">
                    {referral.displayName || referral.contact || referral.referralKey}
                  </div>
                ))}
                {!partner.referrals.length ? <div className="text-xs text-zinc-500">Рефералов пока нет.</div> : null}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Покупки</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {partner.purchases.slice(0, 4).map((purchase) => (
                  <div key={purchase.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs">
                    <div className="truncate font-medium text-white">{purchase.offerTitle}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {formatMoney(purchase.paidAmountKopecks)} • вам {formatMoney(purchase.partnerEarningKopecks)}
                    </div>
                  </div>
                ))}
                {!partner.purchases.length ? <div className="text-xs text-zinc-500">Покупок пока нет.</div> : null}
              </div>
            </div>
          </div>
        </Card>
      ) : null}
      <CoinsShowcase />
    </main>
  );
}
