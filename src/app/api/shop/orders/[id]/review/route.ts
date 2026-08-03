import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/request-rate-limit";
import { ShopError, shopErrorResponse } from "@/lib/shop/errors";
import { createShopReview } from "@/lib/shop/reviews";
import { shopReviewSchema } from "@/lib/shop/validators";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.isBanned) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  const limited = enforceRateLimit(request, "shop-review", { limit: 5, windowMs: 60 * 60_000 }, session.user.id);
  if (limited) return limited;
  const parsed = shopReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Проверьте отзыв.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { id } = await props.params;
    return NextResponse.json({ review: await createShopReview({ orderId: id, buyerId: session.user.id, ...parsed.data }) }, { status: 201 });
  } catch (error) {
    if (!(error instanceof ShopError)) console.error("Shop review failed", error);
    const response = shopErrorResponse(error);
    return NextResponse.json({ error: response.error, code: response.code }, { status: response.status });
  }
}
