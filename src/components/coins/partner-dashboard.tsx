"use client";

import { useState } from "react";
import { BarChart3, ChevronDown, Percent, ShoppingBag, TicketPercent, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PartnerDashboardProps = {
  promoCode: string;
  discountPercent: number;
  partnerPercent: number;
  stats: {
    referrals: number;
    purchases: number;
    turnover: string;
    profit: string;
    earning: string;
  };
  referrals: string[];
  purchases: Array<{
    id: string;
    title: string;
    amount: string;
    earning: string;
  }>;
};

export function PartnerDashboard({ promoCode, discountPercent, partnerPercent, stats, referrals, purchases }: PartnerDashboardProps) {
  const [open, setOpen] = useState(false);
  const [activeList, setActiveList] = useState<"referrals" | "purchases" | null>(null);

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/20 bg-[linear-gradient(180deg,rgba(10,16,28,0.96),rgba(5,9,16,0.98))] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Percent className="h-4 w-4 text-primary" />
            Партнёрская панель
          </CardTitle>
          <CardDescription className="mt-1">Промокод и статистика.</CardDescription>
        </div>
        <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setOpen((value) => !value)}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Открыть панель
          <ChevronDown className={cn("ml-2 h-4 w-4 transition", open && "rotate-180")} />
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                <TicketPercent className="h-4 w-4" />
                Промокод
              </div>
              <div className="mt-2 text-2xl font-black text-white">{promoCode}</div>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">Скидка</div>
              <div className="mt-2 text-2xl font-black text-white">{discountPercent}%</div>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Ваш процент</div>
              <div className="mt-2 text-2xl font-black text-white">{partnerPercent}%</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {[
              ["Рефералы", stats.referrals],
              ["Покупки", stats.purchases],
              ["Оборот", stats.turnover],
              ["Профит", stats.profit],
              ["Заработок", stats.earning],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">{label}</div>
                <div className="mt-1 text-base font-bold text-white">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setActiveList(activeList === "referrals" ? null : "referrals")}>
              <Users className="mr-2 h-4 w-4" />
              Рефералы
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setActiveList(activeList === "purchases" ? null : "purchases")}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Покупки
            </Button>
          </div>

          {activeList === "referrals" ? (
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-2">
              {referrals.map((referral) => (
                <div key={referral} className="truncate rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">
                  {referral}
                </div>
              ))}
              {!referrals.length ? <div className="text-sm text-zinc-500">Рефералов пока нет.</div> : null}
            </div>
          ) : null}

          {activeList === "purchases" ? (
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-2">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                  <div className="truncate font-medium text-white">{purchase.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {purchase.amount} • вам {purchase.earning}
                  </div>
                </div>
              ))}
              {!purchases.length ? <div className="text-sm text-zinc-500">Покупок пока нет.</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
