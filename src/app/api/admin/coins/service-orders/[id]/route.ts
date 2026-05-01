import { NextResponse } from "next/server";
import { CoinServiceOrderStatus, NotificationType, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { pickFairCoinServiceExecutor } from "@/lib/coin-services";
import { createNotification, createNotificationsForUsers } from "@/lib/services/notifications";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.FOUNDER]);

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const action = String(formData.get("_action") ?? "");
  const adminComment = String(formData.get("adminComment") ?? "").trim();
  const order = await db.coinServiceOrder.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, nickname: true, name: true, email: true } },
      executor: { select: { id: true, nickname: true, name: true, email: true } },
    },
  });

  if (!order) {
    redirectUrl.searchParams.set("error", "Заказ не найден.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (action === "reject") {
    await db.coinServiceOrder.update({
      where: { id: order.id },
      data: {
        status: CoinServiceOrderStatus.REJECTED,
        rejectedAt: new Date(),
        adminComment: adminComment || order.adminComment,
      },
    });

    await createNotification({
      userId: order.buyerId,
      title: "Заказ отклонён",
      body: adminComment || `Заказ "${order.productTitle}" отклонён администратором.`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    });

    redirectUrl.searchParams.set("orderUpdated", "1");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (action !== "accept") {
    redirectUrl.searchParams.set("error", "Некорректное действие с заказом.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (order.status !== CoinServiceOrderStatus.PENDING_REVIEW) {
    redirectUrl.searchParams.set("error", "Проверить оплату можно только у заказа на проверке.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const executor = await pickFairCoinServiceExecutor();

  if (!executor) {
    redirectUrl.searchParams.set("error", "Добавьте активного исполнителя перед принятием заказа.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await db.coinServiceOrder.update({
    where: { id: order.id },
    data: {
      executorId: executor.id,
      status: CoinServiceOrderStatus.ACCEPTED,
      acceptedAt: order.acceptedAt ?? new Date(),
      adminComment: adminComment || order.adminComment,
    },
  });

  const executorName = executor.nickname || executor.name || executor.email || "Исполнитель";

  await Promise.all([
    createNotification({
      userId: order.buyerId,
      title: "Оплата проверена",
      body: `Заказ "${order.productTitle}" принят. Исполнитель: ${executorName}.`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    }),
    createNotification({
      userId: executor.id,
      title: "Вам назначен заказ",
      body: `Новый заказ услуги: ${order.productTitle}.`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    }),
    createNotificationsForUsers({
      userIds: order.executorId && order.executorId !== executor.id ? [order.executorId] : [],
      title: "Заказ переназначен",
      body: `Заказ "${order.productTitle}" назначен другому исполнителю.`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    }),
  ]);

  redirectUrl.searchParams.set("orderUpdated", "1");
  return NextResponse.redirect(redirectUrl, 303);
}
