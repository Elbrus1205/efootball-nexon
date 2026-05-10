import { NextResponse } from "next/server";
import { NotificationType, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { createNotificationsForUsers } from "@/lib/services/notifications";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

function canAccessOrder(params: { buyerId: string; executorId?: string | null; userId: string; role: UserRole }) {
  return params.buyerId === params.userId || params.executorId === params.userId || params.role === UserRole.FOUNDER || params.role === UserRole.ORGANIZER || params.role === UserRole.ADMIN;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  const formData = await request.formData();
  const redirectUrl = new URL(`/coins/orders/${params.id}`, getRequestBaseUrl(request));
  const body = String(formData.get("body") ?? "").trim();

  if (body.length < 1 || body.length > 2000) {
    redirectUrl.searchParams.set("error", "Введите сообщение до 2000 символов.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const order = await db.coinServiceOrder.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      buyerId: true,
      executorId: true,
      productTitle: true,
    },
  });

  if (!order || !canAccessOrder({ ...order, userId: session.user.id, role: session.user.role })) {
    redirectUrl.pathname = "/coins";
    redirectUrl.searchParams.set("error", "Заказ не найден.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await db.coinServiceOrderMessage.create({
    data: {
      orderId: order.id,
      senderId: session.user.id,
      body,
    },
  });

  const founders = await db.user.findMany({
    where: {
      role: UserRole.FOUNDER,
      isBanned: false,
    },
    select: { id: true },
  });
  const recipients = new Set<string>([order.buyerId, ...(order.executorId ? [order.executorId] : []), ...founders.map((user) => user.id)]);
  recipients.delete(session.user.id);

  await createNotificationsForUsers({
    userIds: Array.from(recipients),
    title: "Новое сообщение по заказу",
    body: `Заказ "${order.productTitle}": ${body.slice(0, 140)}`,
    type: NotificationType.SYSTEM,
    link: `/coins/orders/${order.id}`,
  });

  redirectUrl.searchParams.set("messageSent", "1");
  return NextResponse.redirect(redirectUrl, 303);
}
