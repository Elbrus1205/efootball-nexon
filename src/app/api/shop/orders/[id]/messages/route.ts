import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/request-rate-limit";
import { getShopOrderForUser } from "@/lib/shop/order-queries";
import { ShopError, shopErrorResponse } from "@/lib/shop/errors";

const schema = z.object({ body: z.string().trim().min(1).max(2_000), attachmentUrl: z.string().url().max(2_048).optional() });

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.isBanned) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  const limited = enforceRateLimit(request, "shop-order-message", { limit: 20, windowMs: 60_000 }, session.user.id);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Сообщение пустое или слишком длинное." }, { status: 400 });
  try {
    const { id } = await props.params;
    await getShopOrderForUser(id, session.user.id);
    const message = await db.shopOrderMessage.create({ data: { orderId: id, senderId: session.user.id, body: parsed.data.body, attachmentUrl: parsed.data.attachmentUrl } });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (!(error instanceof ShopError)) console.error("Shop order message failed", error);
    const response = shopErrorResponse(error);
    return NextResponse.json({ error: response.error, code: response.code }, { status: response.status });
  }
}
