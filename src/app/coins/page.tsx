import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Coins | eFootball Nexon",
  description: "Coins и услуги для eFootball Mobile.",
};

export default function CoinsPage() {
  redirect("/coins/services");
}
