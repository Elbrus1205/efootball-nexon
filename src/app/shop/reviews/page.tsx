import { redirect } from "next/navigation";
import { getShopSettings } from "@/lib/shop/config";

export const dynamic = "force-dynamic";

export default async function LegacyShopReviewsPage() {
  const settings = await getShopSettings();
  redirect(settings.reviewsTelegramUrl ?? "/shop");
}
