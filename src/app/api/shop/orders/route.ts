import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/request-rate-limit";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { ShopError, shopErrorResponse } from "@/lib/shop/errors";
import { listBuyerShopOrders } from "@/lib/shop/order-queries";
import { createShopOrder } from "@/lib/shop/order-service";
import { getPaymentProvider } from "@/lib/shop/payment-provider";
import { beginShopPayment } from "@/lib/shop/payment-service";
import { checkoutShopOrderSchema } from "@/lib/shop/validators";
import { cancelShopOrder } from "@/lib/shop/order-workflow-service";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.isBanned) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  return NextResponse.json(await listBuyerShopOrders(session.user.id, page));
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.isBanned) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  const limited = enforceRateLimit(request, "shop-order-create", { limit: 5, windowMs: 10 * 60_000 }, session.user.id);
  if (limited) return limited;
  const parsed = checkoutShopOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Проверьте данные заказа.", details: parsed.error.flatten() }, { status: 400 });
  let orderId: string | null = null;
  try {
    const provider = getPaymentProvider();
    const order = await createShopOrder({ ...parsed.data, buyerId: session.user.id });
    orderId = order.id;
    const payment = await beginShopPayment({
      orderId: order.id,
      buyerId: session.user.id,
      provider,
      returnUrl: new URL(`/shop/orders/${order.id}`, getRequestBaseUrl(request)).toString(),
    });
    return NextResponse.json({ order: { id: order.id, orderNumber: order.orderNumber }, payment: { checkoutUrl: payment.checkoutUrl, expiresAt: payment.expiresAt } }, { status: 201 });
  } catch (error) {
    if (orderId) await cancelShopOrder(orderId, session.user.id, "Платёжная сессия не создана.").catch(() => null);
    if (!(error instanceof ShopError)) console.error("Shop order creation failed", error);
    const response = shopErrorResponse(error);
    return NextResponse.json({ error: response.error, code: response.code }, { status: response.status });
  }
}
