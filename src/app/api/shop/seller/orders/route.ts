import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { ShopError, shopErrorResponse } from "@/lib/shop/errors";
import { listSellerShopOrders } from "@/lib/shop/order-queries";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.isBanned) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  try {
    const page = Number.parseInt(new URL(request.url).searchParams.get("page") ?? "1", 10);
    return NextResponse.json(await listSellerShopOrders(session.user.id, page));
  } catch (error) {
    if (!(error instanceof ShopError)) console.error("Seller orders query failed", error);
    const response = shopErrorResponse(error);
    return NextResponse.json({ error: response.error, code: response.code }, { status: response.status });
  }
}
