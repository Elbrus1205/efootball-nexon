import Link from "next/link";
import { ArrowRight, BadgePercent, CheckCircle2, ReceiptText, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { formatKopecks } from "@/lib/coin-services";

type ServiceProduct = {
  id: string;
  title: string;
  priceKopecks: number;
};

export function CoinsServicesShowcase({ products }: { products: ServiceProduct[] }) {
  return (
    <section>
      {products.length ? (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product, index) => (
            <Reveal key={product.id} delay={index * 45}>
              <article className="group flex h-full flex-col justify-between gap-3 overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,19,28,0.96),rgba(6,10,15,0.98))] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/25 hover:shadow-[0_18px_48px_rgba(0,0,0,0.28)] sm:rounded-2xl sm:p-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100 sm:h-11 sm:w-11">
                      <BadgePercent className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-100 sm:px-3 sm:text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Есть
                    </span>
                  </div>

                  <h3 className="mt-3 line-clamp-2 min-h-[2.25rem] text-[15px] font-black leading-tight text-white sm:mt-4 sm:min-h-[2.8rem] sm:text-lg">{product.title}</h3>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-xs sm:p-3 sm:text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-zinc-400">
                      <ReceiptText className="h-4 w-4 text-zinc-500" />
                      Цена
                    </span>
                    <span className="font-black text-white">{formatKopecks(product.priceKopecks)}</span>
                  </div>
                </div>

                <Button asChild className="h-10 min-h-0 w-full rounded-xl bg-emerald-400 px-3 text-xs font-black text-black hover:bg-emerald-300 sm:h-11 sm:text-sm">
                  <Link href={`/coins/services/${product.id}`}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Заказать
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </article>
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-500">Услуги скоро появятся.</div>
      )}
    </section>
  );
}
