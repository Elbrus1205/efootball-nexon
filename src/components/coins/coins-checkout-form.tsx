"use client";

import { type FormEvent, useState, useTransition } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CoinsCheckoutForm({
  offerTitle,
  priceLabel,
  platformLabel,
  initialPlayerName = "",
}: {
  offerTitle: string;
  priceLabel: string;
  platformLabel: string;
  initialPlayerName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [contact, setContact] = useState("");
  const [comment, setComment] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (playerName.trim().length < 2) {
      toast.error("Укажи ник или имя игрока для оформления.");
      return;
    }

    startTransition(async () => {
      toast.message("Checkout подготовлен под ЮKassa", {
        description: `${offerTitle} • ${platformLabel} • ${priceLabel}. Когда подключишь ЮKassa, сюда можно будет добавить создание платежа.`,
      });
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(6,10,16,0.98))] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.28)] sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-200">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Оформление</div>
          <div className="mt-1 text-2xl font-black text-white">Данные для оплаты</div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="player-name">Ник или имя игрока</Label>
          <Input
            id="player-name"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Например, ElbrusEN"
            className="bg-white/[0.04]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact">Telegram или email</Label>
          <Input
            id="contact"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="@nickname или email@example.com"
            className="bg-white/[0.04]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment">Комментарий к заказу</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Можно указать ID, пожелания по заказу или удобный способ связи."
            className="min-h-[140px] bg-white/[0.04]"
          />
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50/90">
        Это подготовленный шаг под онлайн-оплату. После подключения ЮKassa сюда можно будет добавить создание платежа и редирект на
        оплату без переделки страницы.
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-white">Что будет дальше</div>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Сейчас кнопка завершает подготовленный checkout-сценарий. Позже здесь можно вызвать API создания платежа и открыть
              страницу ЮKassa.
            </p>
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="mt-6 h-12 w-full rounded-full bg-emerald-400 text-black hover:bg-emerald-300">
        {pending ? "Подготавливаем..." : "Оплатить через ЮKassa"}
      </Button>
    </form>
  );
}
