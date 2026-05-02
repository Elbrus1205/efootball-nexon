import Image from "next/image";
import { Handshake, Send, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WHITE_STORE_NAME,
  WHITE_STORE_PROMO_CODE,
  WHITE_STORE_PROMO_DISCOUNT_PERCENT,
  WHITE_STORE_TELEGRAM_REFERRAL_URL,
} from "@/lib/white-store";

const partnerLogos = [
  {
    name: "eFootball Nexon",
    src: "/images-site/IMG_6086.PNG",
  },
  {
    name: WHITE_STORE_NAME,
    src: "/images-site/IMG_6085.PNG",
  },
];

export function CoinsPartnerBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(11,16,26,0.98),rgba(8,11,18,0.98)_48%,rgba(18,23,32,0.98))] p-4 shadow-[0_18px_54px_rgba(2,6,23,0.24)] sm:p-5 lg:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(250,204,21,0.65),rgba(56,189,248,0.5),transparent)]" />

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(250px,320px)] lg:items-center">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-zinc-300 sm:text-xs">
            <Handshake className="h-3.5 w-3.5 text-sky-300 sm:h-4 sm:w-4" />
            Сотрудничество
          </div>

          <h1 className="mt-3 max-w-3xl text-[1.45rem] font-black leading-tight text-white sm:text-3xl lg:text-[2.15rem]">
            eFootball Nexon x {WHITE_STORE_NAME}
          </h1>

          <p className="mt-3 max-w-2xl text-[13px] leading-5 text-zinc-300 sm:text-[15px] sm:leading-6">
            Покупка Coins проходит через {WHITE_STORE_NAME}. По кнопке покупки мы переводим вас прямо в Telegram-магазин по партнерской ссылке eFootball Nexon.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex w-full items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[12px] font-semibold leading-5 text-amber-100 sm:w-auto sm:rounded-full sm:text-sm">
              <TicketPercent className="h-4 w-4 shrink-0" />
              <span>Промокод {WHITE_STORE_PROMO_CODE}: -{WHITE_STORE_PROMO_DISCOUNT_PERCENT}% на первую покупку</span>
            </div>

            <Button asChild className="h-11 w-full rounded-xl bg-sky-400 px-4 text-sm font-bold text-slate-950 hover:bg-sky-300 sm:w-auto sm:rounded-2xl sm:px-5">
              <a href={WHITE_STORE_TELEGRAM_REFERRAL_URL}>
                <Send className="mr-2 h-4 w-4" />
                Открыть White Store
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:max-w-md lg:max-w-none">
          {partnerLogos.map((logo) => (
            <div
              key={logo.name}
              className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-3"
            >
              <div className="relative h-full w-full overflow-hidden rounded-full">
                <Image src={logo.src} alt={logo.name} fill sizes="(max-width: 640px) 42vw, 148px" className="object-cover" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
