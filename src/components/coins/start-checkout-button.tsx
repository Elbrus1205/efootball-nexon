"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CoinsPlatform } from "@/lib/coins-catalog";

export function StartCheckoutButton({
  offerId,
  platform,
  className,
  children,
}: {
  offerId: string;
  platform: CoinsPlatform;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const response = await fetch("/api/coins/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, platform }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.checkoutUrl) {
        toast.error(payload?.error || "Не удалось открыть оформление оплаты.");
        return;
      }

      router.push(payload.checkoutUrl);
    });
  };

  return (
    <Button onClick={handleClick} disabled={pending} size="lg" className={className}>
      {pending ? "Открываем..." : children}
    </Button>
  );
}
