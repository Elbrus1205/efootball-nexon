import { Handshake, Send, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WHITE_STORE_NAME,
  WHITE_STORE_PROMO_CODE,
  WHITE_STORE_PROMO_DISCOUNT_PERCENT,
  WHITE_STORE_SITE_URL,
  WHITE_STORE_TELEGRAM_REFERRAL_URL,
} from "@/lib/white-store";

export function CoinsPartnerBanner() {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(16,23,37,0.98),rgba(10,15,25,0.96)_52%,rgba(22,28,39,0.98))] px-5 py-5 shadow-[0_18px_54px_rgba(2,6,23,0.22)] sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            <Handshake className="h-4 w-4 text-sky-300" />
            Сотрудничество
          </div>

          <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">Сотрудничество eFootball Nexon с {WHITE_STORE_NAME}</h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-[15px]">
            Покупка Coins проходит через магазин {WHITE_STORE_NAME}. По кнопке покупки мы переводим прямо в их Telegram-магазин по
            нашей реферальной ссылке.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100">
              <TicketPercent className="h-4 w-4" />
              Промокод {WHITE_STORE_PROMO_CODE} даёт -{WHITE_STORE_PROMO_DISCOUNT_PERCENT}% на первую покупку
            </div>
            <a
              href={WHITE_STORE_SITE_URL}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
              target="_blank"
              rel="noreferrer"
            >
              whitegamestore.ru
            </a>
          </div>
        </div>

        <div className="shrink-0">
          <Button asChild className="h-11 rounded-2xl bg-sky-400 px-5 text-sm font-bold text-slate-950 hover:bg-sky-300">
            <a href={WHITE_STORE_TELEGRAM_REFERRAL_URL}>
              <Send className="mr-2 h-4 w-4" />
              Открыть White Store
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
