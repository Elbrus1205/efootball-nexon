import Link from "next/link";
import { BarChart3, ClipboardList, Coins, Handshake, ShoppingBag, UserCheck, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type CoinsProfileSidebarProps = {
  userName?: string;
  isSignedIn: boolean;
  isPartner: boolean;
  isExecutor: boolean;
  buyerOrdersCount: number;
  buyerActiveOrdersCount: number;
  executorOrdersCount: number;
  executorActiveOrdersCount: number;
  partnerStats?: {
    referrals: number;
    purchases: number;
    earning: string;
  };
};

export function CoinsProfileSidebar({
  userName,
  isSignedIn,
  isPartner,
  isExecutor,
  buyerOrdersCount,
  buyerActiveOrdersCount,
  executorOrdersCount,
  executorActiveOrdersCount,
  partnerStats,
}: CoinsProfileSidebarProps) {
  return (
    <Card className="rounded-[1.75rem] border-primary/15 bg-[linear-gradient(180deg,rgba(9,15,27,0.98),rgba(5,8,14,0.98))] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-blue-100">
          <UserCircle className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <CardTitle className="truncate text-lg">Профиль Coins</CardTitle>
          <CardDescription className="truncate">{isSignedIn ? userName || "Игрок" : "Войдите в аккаунт"}</CardDescription>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Покупки</div>
          <div className="mt-1 text-xl font-black text-white">{buyerOrdersCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Активные</div>
          <div className="mt-1 text-xl font-black text-emerald-100">{buyerActiveOrdersCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Исполнитель</div>
          <div className="mt-1 text-xl font-black text-white">{executorOrdersCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">В работе</div>
          <div className="mt-1 text-xl font-black text-sky-100">{executorActiveOrdersCount}</div>
        </div>
      </div>

      {partnerStats ? (
        <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
            <BarChart3 className="h-4 w-4" />
            Партнёрка
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="font-bold text-white">{partnerStats.referrals}</div>
              <div className="text-[10px] text-amber-100/70">рефералы</div>
            </div>
            <div>
              <div className="font-bold text-white">{partnerStats.purchases}</div>
              <div className="text-[10px] text-amber-100/70">покупки</div>
            </div>
            <div>
              <div className="font-bold text-white">{partnerStats.earning}</div>
              <div className="text-[10px] text-amber-100/70">доход</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {isSignedIn ? (
          <Button asChild variant="outline" className="justify-start rounded-xl">
            <Link href="#coins-profile">
              <ClipboardList className="mr-2 h-4 w-4" />
              Заказы покупателя
            </Link>
          </Button>
        ) : (
          <Button asChild className="rounded-xl">
            <Link href="/login">
              <UserCircle className="mr-2 h-4 w-4" />
              Войти
            </Link>
          </Button>
        )}

        <Button asChild variant="outline" className="justify-start rounded-xl">
          <Link href="#services">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Услуги
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start rounded-xl">
          <Link href="#coins-catalog">
            <Coins className="mr-2 h-4 w-4" />
            Coins
          </Link>
        </Button>
        {isPartner ? (
          <Button asChild variant="outline" className="justify-start rounded-xl">
            <Link href="#partner-panel">
              <Handshake className="mr-2 h-4 w-4" />
              Партнёрка
            </Link>
          </Button>
        ) : null}
        {isExecutor ? (
          <Button asChild variant="outline" className="justify-start rounded-xl">
            <Link href="#coins-profile">
              <UserCheck className="mr-2 h-4 w-4" />
              Исполнитель
            </Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
