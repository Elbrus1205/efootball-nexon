import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/request-rate-limit";
import { ShopError, shopErrorResponse } from "@/lib/shop/errors";
import { previewShopOrder } from "@/lib/shop/order-service";
import { checkoutShopOrderSchema } from "@/lib/shop/validators";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.isBanned) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  const limited = enforceRateLimit(request, "shop-order-preview", { limit: 30, windowMs: 60_000 }, session.user.id);
  if (limited) return limited;
  const parsed = checkoutShopOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Проверьте данные заказа.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const preview = await previewShopOrder({ ...parsed.data, buyerId: session.user.id });
    return NextResponse.json({ preview });
  } catch (error) {
    if (!(error instanceof ShopError)) console.error("Shop order preview failed", error);
    const response = shopErrorResponse(error);
    return NextResponse.json({ error: response.error, code: response.code }, { status: response.status });
  }
}
