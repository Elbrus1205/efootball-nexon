import type { Metadata } from "next";
import { CoinsShowcase } from "@/components/coins/coins-showcase";

export const metadata: Metadata = {
  title: "Coins | eFootball Nexon",
  description: "Покупка Coins для eFootball Mobile: Android, iOS и акционные наборы в одном каталоге.",
};

export default function CoinsPage() {
  return (
    <main className="page-shell py-0 pb-12 sm:pb-16">
      <CoinsShowcase />
    </main>
  );
}
