import type { CoinPaymentBank } from "@prisma/client";
import { CreditCard, KeyRound, MessageSquareText, Paperclip, Send } from "lucide-react";
import { BankLogo } from "@/components/coins/bank-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ServiceOrderFormProps = {
  productId: string;
  productTitle: string;
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
  paymentCardId,
  paymentBank,
  paymentCard,
  paymentRecipient,
  paymentComment,
  initialTelegram = "",
  error,
}: ServiceOrderFormProps) {
  return (
    <form action="/api/coins/service-orders" method="post" className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(6,10,16,0.98))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:rounded-[2rem] sm:p-8">
      <input type="hidden" name="productId" value={productId} />
      {paymentCardId ? <input type="hidden" name="paymentCardId" value={paymentCardId} /> : null}

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-200 sm:h-12 sm:w-12 sm:rounded-2xl">
          <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase text-zinc-500 sm:text-xs">Оформление услуги</div>
          <div className="mt-1 text-xl font-black leading-tight text-white sm:text-2xl">{productTitle}</div>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100 sm:mt-5">{error}</div> : null}

      <div className="mt-4 grid gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-3 text-xs sm:mt-6 sm:p-4 sm:text-sm">
        <div className="font-semibold text-emerald-100">Реквизиты для оплаты</div>
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

      <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
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
          <p className="text-[11px] leading-5 text-zinc-500 sm:text-xs">Если Telegram привязан к профилю, он подставится автоматически.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
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

        <div className="space-y-2 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-3 sm:p-4">
          <Label htmlFor="paymentReceiptUrl" className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-emerald-200" />
            Прикрепить чек оплаты
          </Label>
          <Input
            id="paymentReceiptUrl"
            name="paymentReceiptUrl"
            required
            type="url"
            placeholder="https://..."
            className="bg-black/30"
          />
          <p className="text-[11px] leading-5 text-emerald-100/80 sm:text-xs">Ссылка на чек или скрин перевода нужна администратору для проверки оплаты.</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-[11px] leading-5 text-amber-100 sm:mt-5 sm:text-xs">
        <div className="flex items-start gap-2">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          Данные Konami ID увидит администратор и назначенный исполнитель заказа.
        </div>
      </div>

      <Button type="submit" size="lg" disabled={!paymentCardId} className="mt-4 h-11 w-full rounded-xl bg-emerald-400 text-black hover:bg-emerald-300 sm:mt-6 sm:h-12 sm:rounded-full">
        <Send className="mr-2 h-4 w-4" />
        {paymentCardId ? "Я оплатил заказ" : "Оплата временно недоступна"}
      </Button>

      <div className="mt-3 flex items-center gap-2 text-[11px] leading-5 text-zinc-500 sm:mt-4 sm:text-xs">
        <MessageSquareText className="h-4 w-4" />
        После принятия заказа откроется чат с исполнителем.
      </div>
    </form>
  );
}
