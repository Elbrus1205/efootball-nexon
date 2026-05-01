import { NextResponse } from "next/server";
import { CoinServiceOrderStatus, NotificationType, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { createNotification, createNotificationsForUsers } from "@/lib/services/notifications";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

function isOrderAdmin(role: UserRole) {
  return role === UserRole.FOUNDER || role === UserRole.ORGANIZER;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  const formData = await request.formData();
  const redirectUrl = new URL(`/coins/orders/${params.id}`, getRequestBaseUrl(request));
  const action = String(formData.get("_action") ?? "");
  const order = await db.coinServiceOrder.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      buyerId: true,
      executorId: true,
      status: true,
      productTitle: true,
    },
  });

  if (!order) {
    redirectUrl.pathname = "/coins";
    redirectUrl.searchParams.set("error", "Заказ не найден.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const admin = isOrderAdmin(session.user.role);

  if (action === "executor_done") {
    if (!admin && order.executorId !== session.user.id) {
      redirectUrl.searchParams.set("error", "Отметить выполнение может только исполнитель.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (order.status !== CoinServiceOrderStatus.ACCEPTED) {
      redirectUrl.searchParams.set("error", "Заказ нельзя отметить выполненным в текущем статусе.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    await db.coinServiceOrder.update({
      where: { id: order.id },
      data: {
        status: CoinServiceOrderStatus.EXECUTOR_DONE,
        executorCompletedAt: new Date(),
      },
    });

    await createNotification({
      userId: order.buyerId,
      title: "Исполнитель завершил заказ",
      body: `Проверьте заказ "${order.productTitle}" и подтвердите выполнение.`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    });

    redirectUrl.searchParams.set("orderUpdated", "1");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (action === "buyer_complete") {
    if (!admin && order.buyerId !== session.user.id) {
      redirectUrl.searchParams.set("error", "Подтвердить заказ может только покупатель.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (order.status !== CoinServiceOrderStatus.ACCEPTED && order.status !== CoinServiceOrderStatus.EXECUTOR_DONE) {
      redirectUrl.searchParams.set("error", "Заказ нельзя завершить в текущем статусе.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    await db.coinServiceOrder.update({
      where: { id: order.id },
      data: {
        status: CoinServiceOrderStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    const founders = await db.user.findMany({
      where: {
        role: UserRole.FOUNDER,
        isBanned: false,
      },
      select: { id: true },
    });

    await createNotificationsForUsers({
      userIds: [order.executorId, ...founders.map((user) => user.id)].filter(Boolean) as string[],
      title: "Заказ завершён",
      body: `Покупатель подтвердил выполнение заказа "${order.productTitle}".`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    });

    redirectUrl.searchParams.set("orderUpdated", "1");
    return NextResponse.redirect(redirectUrl, 303);
  }

  redirectUrl.searchParams.set("error", "Некорректное действие с заказом.");
  return NextResponse.redirect(redirectUrl, 303);
}
