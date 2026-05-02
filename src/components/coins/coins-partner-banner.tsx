import Image from "next/image";
import { Fragment } from "react";
import { Handshake, Send, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

function PartnerLogoPair({
  className,
  logoClassName,
  sizes,
}: {
  className?: string;
  logoClassName?: string;
  sizes: string;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      {partnerLogos.map((logo, index) => (
        <Fragment key={logo.name}>
          <div
            className={cn("coins-partner-logo flex shrink-0 items-center justify-center rounded-full p-[2px]", logoClassName)}
            style={{ animationDelay: `${index * 0.45}s` }}
          >
            <div className="relative z-10 h-full w-full overflow-hidden rounded-full bg-black">
              <Image src={logo.src} alt={logo.name} fill sizes={sizes} className="object-cover" />
            </div>
          </div>

          {index === 0 ? <div className="coins-partner-link-line mx-1.5 h-px w-5 shrink-0 rounded-full sm:mx-2 sm:w-7" /> : null}
        </Fragment>
      ))}
    </div>
  );
}

export function CoinsPartnerBanner() {
  return (
    <section className="coins-partner-banner relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(11,16,26,0.98),rgba(8,11,18,0.98)_50%,rgba(18,23,32,0.98))] p-3.5 shadow-[0_16px_46px_rgba(2,6,23,0.22)] sm:p-5 lg:p-6">
      <div className="absolute inset-x-0 top-0 z-20 h-px bg-[linear-gradient(90deg,transparent,rgba(250,204,21,0.62),rgba(56,189,248,0.48),transparent)]" />

      <div className="relative z-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="coins-partner-chip inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[10px] font-semibold text-zinc-300 sm:text-xs">
              <Handshake className="h-3.5 w-3.5 text-sky-300 sm:h-4 sm:w-4" />
              Сотрудничество
            </div>

            <PartnerLogoPair className="lg:hidden" logoClassName="h-11 w-11 sm:h-12 sm:w-12" sizes="48px" />
          </div>

          <h1 className="mt-3 max-w-3xl text-[1.28rem] font-black leading-tight text-white sm:text-3xl lg:text-[2rem]">
            eFootball Nexon x {WHITE_STORE_NAME}
          </h1>

          <p className="mt-2.5 max-w-2xl text-[12.5px] leading-5 text-zinc-300 sm:text-[15px] sm:leading-6">
            {WHITE_STORE_NAME} — партнёрский магазин eFootball Nexon для покупки Coins. Нажмите «Открыть White Store», чтобы перейти в Telegram и оформить заказ.
          </p>

          <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-xl border border-amber-300/25 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(180,83,9,0.12))] px-3 py-2 text-amber-100 shadow-[0_10px_26px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(255,255,255,0.1)] sm:w-auto sm:rounded-full sm:flex-nowrap">
              <TicketPercent className="h-4 w-4 shrink-0 text-amber-200" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">Промокод</span>
              <span className="rounded-lg bg-amber-200 px-2 py-1 text-xs font-black leading-none text-[#1f1604] shadow-[0_0_18px_rgba(251,191,36,0.2)]">
                {WHITE_STORE_PROMO_CODE}
              </span>
              <span className="text-[12px] font-black leading-5 text-amber-50 sm:text-sm">
                -{WHITE_STORE_PROMO_DISCOUNT_PERCENT}% на первую покупку
              </span>
            </div>

            <Button asChild className="coins-partner-cta h-10 w-full rounded-xl bg-sky-400 px-4 text-sm font-bold text-slate-950 hover:bg-sky-300 sm:h-11 sm:w-auto sm:rounded-2xl sm:px-5">
              <a href={WHITE_STORE_TELEGRAM_REFERRAL_URL}>
                <Send className="mr-2 h-4 w-4" />
                Открыть White Store
              </a>
            </Button>
          </div>
        </div>

        <div className="hidden justify-self-end rounded-2xl border border-white/10 bg-black/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:block">
          <PartnerLogoPair className="justify-center" logoClassName="h-[74px] w-[74px] xl:h-20 xl:w-20" sizes="80px" />
        </div>
      </div>
    </section>
  );
}
