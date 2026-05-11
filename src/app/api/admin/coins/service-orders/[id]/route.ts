import { NextResponse } from "next/server";
import { CoinServiceOrderStatus, NotificationType } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { assignNextCoinServiceExecutor } from "@/lib/coin-services";
import { createNotification, createNotificationsForUsers } from "@/lib/services/notifications";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requirePermission("coins.manage");

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const action = String(formData.get("_action") ?? "");
  const adminComment = String(formData.get("adminComment") ?? "").trim();
  const order = await db.coinServiceOrder.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, name: true, email: true } },
      executor: { select: { id: true, name: true, email: true } },
    },
  });

  if (!order) {
    redirectUrl.searchParams.set("error", "Заказ не найден.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (action === "reject") {
    if (!adminComment) {
      redirectUrl.searchParams.set("error", "Укажите причину отмены заказа.");
      return NextResponse.redirect(redirectUrl, 303);
    }

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

  if (order.status !== CoinServiceOrderStatus.PENDING_REVIEW && order.status !== CoinServiceOrderStatus.AWAITING_EXECUTOR) {
    redirectUrl.searchParams.set("error", "Проверить оплату или назначить исполнителя можно только у заказа на проверке или без свободного исполнителя.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await db.coinServiceOrder.update({
    where: { id: order.id },
    data: {
      paidAt: order.paidAt ?? new Date(),
      adminComment: adminComment || order.adminComment,
    },
  });

  const executor = await assignNextCoinServiceExecutor(order.id);

  if (!executor) {
    redirectUrl.searchParams.set("error", "Оплата подтверждена, но активных исполнителей нет. Добавьте исполнителя и нажмите «Заказ оплачен» ещё раз.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const executorName = executor.name || executor.email || "Исполнитель";

  await Promise.all([
    createNotification({
      userId: order.buyerId,
      title: "Оплата проверена",
      body: `Заказ "${order.productTitle}" оплачен. Исполнитель ${executorName} получил заявку и должен принять её в работу.`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    }),
    createNotification({
      userId: executor.id,
      title: "Вам назначен заказ",
      body: `Новый заказ услуги: ${order.productTitle}. Примите его в работу или откажитесь с причиной.`,
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
