import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { ShopError, shopErrorResponse } from "@/lib/shop/errors";
import { getShopOrderForUser } from "@/lib/shop/order-queries";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.isBanned) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  try {
    const { id } = await props.params;
    return NextResponse.json({ order: await getShopOrderForUser(id, session.user.id) });
  } catch (error) {
    if (!(error instanceof ShopError)) console.error("Shop order query failed", error);
    const response = shopErrorResponse(error);
    return NextResponse.json({ error: response.error, code: response.code }, { status: response.status });
  }
}
