import Link from "next/link";
import { ArrowRight, BadgePercent, Gamepad2 } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKopecks } from "@/lib/coin-services";

type ServiceProduct = {
  id: string;
  title: string;
  priceKopecks: number;
};

export function CoinsServicesShowcase({ products }: { products: ServiceProduct[] }) {
  return (
    <section className="space-y-4">
      <Card className="rounded-3xl border-emerald-300/15 bg-[linear-gradient(180deg,rgba(8,20,17,0.96),rgba(5,10,13,0.98))]">
        <CardHeader className="mb-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/70">
                <Gamepad2 className="h-4 w-4" />
                Магазин услуг
              </div>
              <CardTitle className="mt-2 text-2xl font-black">Повышение дивизиона eFootball</CardTitle>
              <CardDescription className="mt-2 max-w-2xl">
                Выберите услугу, заполните Telegram и данные Konami ID. После оплаты администратор примет заказ и назначит исполнителя.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {products.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product, index) => (
            <Reveal key={product.id} delay={index * 45}>
              <article className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,19,28,0.96),rgba(6,10,15,0.98))] p-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                      <BadgePercent className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100">
                      {formatKopecks(product.priceKopecks)}
                    </span>
                  </div>
                  <h3 className="mt-4 min-h-[3.5rem] text-lg font-black leading-tight text-white">{product.title}</h3>
                </div>

                <Button asChild className="w-full rounded-xl bg-emerald-400 text-black hover:bg-emerald-300">
                  <Link href={`/coins/services/${product.id}`}>
                    Заказать
                    <ArrowRight className="ml-2 h-4 w-4" />
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
