import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/request-rate-limit";
import { ShopError, shopErrorResponse } from "@/lib/shop/errors";
import { cancelShopOrder, openShopDispute, sellerCompleteShopOrder } from "@/lib/shop/order-workflow-service";
import { shopOrderActionSchema } from "@/lib/shop/validators";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.isBanned) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  const limited = enforceRateLimit(request, "shop-order-action", { limit: 20, windowMs: 60_000 }, session.user.id);
  if (limited) return limited;
  const parsed = shopOrderActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректное действие." }, { status: 400 });
  const { id } = await props.params;
  try {
    const data = parsed.data;
    const order = data.action === "CANCEL" ? await cancelShopOrder(id, session.user.id, data.comment)
      : data.action === "SELLER_COMPLETE" ? await sellerCompleteShopOrder(id, session.user.id, data.comment)
      : await openShopDispute(id, session.user.id, { reason: data.reason ?? "OTHER", description: data.comment ?? "Проблема с выполнением заказа.", desiredResolution: data.desiredResolution });
    return NextResponse.json({ order: { id: order.id, status: order.status } });
  } catch (error) {
    if (!(error instanceof ShopError)) console.error("Shop order action failed", error);
    const response = shopErrorResponse(error);
    return NextResponse.json({ error: response.error, code: response.code }, { status: response.status });
  }
}
