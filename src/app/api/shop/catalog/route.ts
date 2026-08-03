import { NextResponse } from "next/server";
import { listShopCategories, listShopProducts } from "@/lib/shop/catalog";
import { getShopAvailability, getShopSettings } from "@/lib/shop/config";
import { getPaymentReadiness } from "@/lib/shop/payment-provider";
import { shopCatalogQuerySchema } from "@/lib/shop/validators";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = shopCatalogQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Некорректные параметры каталога." }, { status: 400 });
  const settings = await getShopSettings();
  const [categories, products] = await Promise.all([listShopCategories(), listShopProducts(parsed.data)]);
  return NextResponse.json({ availability: getShopAvailability(settings), payment: getPaymentReadiness(), categories, products });
}
