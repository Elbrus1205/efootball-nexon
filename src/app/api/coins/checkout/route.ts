import { NextResponse } from "next/server";
import { z } from "zod";
import { getCoinsCheckoutPath } from "@/lib/coins-catalog";
import { getCoinsProductOffer } from "@/lib/coins-products";

const checkoutRequestSchema = z.object({
  offerId: z.string().min(1),
  platform: z.enum(["android", "ios", "promo"]),
});

export async function POST(request: Request) {
  const parsedBody = checkoutRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Не удалось подготовить оплату." }, { status: 400 });
  }

  const { offerId, platform } = parsedBody.data;
  const offer = await getCoinsProductOffer(platform, offerId);

  if (!offer) {
    return NextResponse.json({ error: "Пакет не найден." }, { status: 404 });
  }

  return NextResponse.json({
    checkoutUrl: getCoinsCheckoutPath(platform, offerId),
  });
}
