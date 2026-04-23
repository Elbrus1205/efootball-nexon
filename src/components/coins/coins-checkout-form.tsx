"use client";

import { type FormEvent, useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TELEGRAM_CONTACT_REGEX = /^(?:@[\w_]{5,32}|(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_]{5,32}\/?)$/i;

export function CoinsCheckoutForm({
  offerTitle,
  priceLabel,
  platformLabel,
  initialTelegram = "",
}: {
  offerTitle: string;
  priceLabel: string;
  platformLabel: string;
  initialTelegram?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [playerName, setPlayerName] = useState("");
  const [contact, setContact] = useState(initialTelegram);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (playerName.trim().length < 2) {
      toast.error("Укажи ваше имя для оформления.");
      return;
    }

    if (!TELEGRAM_CONTACT_REGEX.test(contact.trim())) {
      toast.error("Укажи Telegram: @username или ссылку t.me/username.");
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
          <Label htmlFor="player-name">Ваше имя</Label>
          <Input
            id="player-name"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Например, Эльбрус"
            className="bg-white/[0.04]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact">Telegram</Label>
          <Input
            id="contact"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="@username или https://t.me/username"
            className="bg-white/[0.04]"
          />
          <p className="text-xs text-zinc-500">Если Telegram привязан к профилю, он подставится автоматически.</p>
        </div>
      </div>
      <Button type="submit" size="lg" className="mt-6 h-12 w-full rounded-full bg-emerald-400 text-black hover:bg-emerald-300">
        {pending ? "Подготавливаем..." : "Оплатить через ЮKassa"}
      </Button>
    </form>
  );
}
