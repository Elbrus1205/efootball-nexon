import type { CoinPaymentBank } from "@prisma/client";
import { CreditCard, KeyRound, MessageSquareText, Send } from "lucide-react";
import { BankLogo } from "@/components/coins/bank-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatKopecks } from "@/lib/coin-services";

type ServiceOrderFormProps = {
  productId: string;
  productTitle: string;
  priceKopecks: number;
  paymentCardId?: string;
  paymentBank?: CoinPaymentBank | null;
  paymentCard: string;
  paymentRecipient: string;
  paymentComment: string;
  initialTelegram?: string;
  error?: string;
};

export function ServiceOrderForm({
  productId,
  productTitle,
  priceKopecks,
  paymentCardId,
  paymentBank,
  paymentCard,
  paymentRecipient,
  paymentComment,
  initialTelegram = "",
  error,
}: ServiceOrderFormProps) {
  return (
    <form action="/api/coins/service-orders" method="post" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(6,10,16,0.98))] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.28)] sm:p-8">
      <input type="hidden" name="productId" value={productId} />
      {paymentCardId ? <input type="hidden" name="paymentCardId" value={paymentCardId} /> : null}

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-200">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Оформление услуги</div>
          <div className="mt-1 text-2xl font-black text-white">{productTitle}</div>
        </div>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}

      <div className="mt-6 grid gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-zinc-300">Сумма к оплате</span>
          <span className="text-lg font-black text-emerald-100">{formatKopecks(priceKopecks)}</span>
        </div>
        <div className="grid gap-2 text-zinc-300">
          <div>
            <span className="text-zinc-500">Банк: </span>
            {paymentBank ? <BankLogo bank={paymentBank} className="ml-1" /> : <span className="font-semibold text-white">не выбран</span>}
          </div>
          <div>
            <span className="text-zinc-500">Карта: </span>
            <span className="font-semibold text-white">{paymentCard || "не указана"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Получатель: </span>
            <span className="font-semibold text-white">{paymentRecipient || "не указан"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Комментарий к переводу: </span>
            <span className="font-semibold text-white">{paymentComment || "не указан"}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="buyerTelegram">Telegram</Label>
          <Input
            id="buyerTelegram"
            name="buyerTelegram"
            required
            defaultValue={initialTelegram}
            placeholder="@username или https://t.me/username"
            className="bg-white/[0.04]"
          />
          <p className="text-xs text-zinc-500">Если Telegram привязан к профилю, он подставится автоматически.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="konamiLogin">Логин Konami ID</Label>
            <Input id="konamiLogin" name="konamiLogin" required placeholder="email или Konami ID" className="bg-white/[0.04]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="konamiPassword">Пароль Konami ID</Label>
            <Input id="konamiPassword" name="konamiPassword" required type="password" placeholder="Пароль для входа" className="bg-white/[0.04]" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="buyerComment">Комментарий к заказу</Label>
          <Textarea id="buyerComment" name="buyerComment" placeholder="Например: нужен дивизион 1, удобное время, дополнительные пожелания" />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
        <div className="flex items-start gap-2">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          Данные Konami ID увидит администратор и назначенный исполнитель заказа.
        </div>
      </div>

      <Button type="submit" size="lg" disabled={!paymentCardId} className="mt-6 h-12 w-full rounded-full bg-emerald-400 text-black hover:bg-emerald-300">
        <Send className="mr-2 h-4 w-4" />
        {paymentCardId ? "Отправить заказ и оплатить" : "Оплата временно недоступна"}
      </Button>

      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
        <MessageSquareText className="h-4 w-4" />
        После принятия заказа откроется чат с исполнителем.
      </div>
    </form>
  );
}
