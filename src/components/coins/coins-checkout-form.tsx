"use client";

import { type FormEvent, useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
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
      <Button type="submit" size="lg" className="mt-6 h-12 w-full rounded-full bg-emerald-400 text-black hover:bg-emerald-300">
        {pending ? "Подготавливаем..." : "Оплатить через ЮKassa"}
      </Button>
    </form>
  );
}
