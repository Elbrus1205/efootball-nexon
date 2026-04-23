import type { Metadata } from "next";
import { CoinsShowcase } from "@/components/coins/coins-showcase";

export const metadata: Metadata = {
  title: "Coins | eFootball Nexon",
  description: "Покупка Coins для eFootball Mobile: Android, iOS и акционные наборы в одном каталоге.",
};

const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";

export default function CoinsPage() {
  return (
    <main className="page-shell py-0 pb-12 sm:pb-16">
      <CoinsShowcase telegramHref={telegramHref} />
    </main>
  );
}
