import { NextResponse } from "next/server";
import { ShopError, shopErrorResponse } from "@/lib/shop/errors";
import { getPaymentProvider } from "@/lib/shop/payment-provider";
import { processShopPaymentWebhook } from "@/lib/shop/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request, props: { params: Promise<{ provider: string }> }) {
  const { provider: slug } = await props.params;
  try {
    const provider = getPaymentProvider();
    if (provider.name !== slug) return NextResponse.json({ error: "Провайдер webhook не совпадает с настройкой магазина." }, { status: 404 });
    const result = await processShopPaymentWebhook({ provider, headers: request.headers, body: await request.text() });
    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ShopError)) console.error("Shop payment webhook failed", error);
    const response = shopErrorResponse(error);
    return NextResponse.json({ error: response.error, code: response.code }, { status: response.status });
  }
}
