import { NextResponse } from "next/server";
import { CoinProductPlatform, UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { rublesToKopecks } from "@/lib/coins-products";
import { db } from "@/lib/db";

const productSchema = z.object({
  platform: z.nativeEnum(CoinProductPlatform),
  coins: z.coerce.number().int().min(1).max(1_000_000),
  priceRubles: z.string().min(1),
  costRubles: z.string().min(1),
});

export async function POST(request: Request) {
  await requireRole([UserRole.FOUNDER]);

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const parsed = productSchema.safeParse({
    platform: formData.get("platform"),
    coins: formData.get("coins"),
    priceRubles: formData.get("priceRubles"),
    costRubles: formData.get("costRubles"),
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", "Проверьте поля товара Coins.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const priceKopecks = rublesToKopecks(parsed.data.priceRubles);
  const costKopecks = rublesToKopecks(parsed.data.costRubles);

  if (priceKopecks <= 0 || costKopecks < 0) {
    redirectUrl.searchParams.set("error", "Укажите корректную цену товара.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await db.coinProduct.create({
    data: {
      platform: parsed.data.platform,
      coins: parsed.data.coins,
      title: `${new Intl.NumberFormat("ru-RU").format(parsed.data.coins)} Coins`,
      priceKopecks,
      costKopecks,
    },
  });

  redirectUrl.searchParams.set("productCreated", "1");
  return NextResponse.redirect(redirectUrl, 303);
}
