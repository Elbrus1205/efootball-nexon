import { NextResponse } from "next/server";
import { CoinServiceOrderStatus, NotificationType, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { assignNextCoinServiceExecutor } from "@/lib/coin-services";
import { createNotification, createNotificationsForUsers } from "@/lib/services/notifications";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

function isOrderAdmin(role: UserRole) {
  return role === UserRole.FOUNDER || role === UserRole.ORGANIZER || role === UserRole.ADMIN;
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

  if (action === "executor_accept") {
    if (!admin && order.executorId !== session.user.id) {
      redirectUrl.searchParams.set("error", "Принять заказ может только назначенный исполнитель.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (order.status !== CoinServiceOrderStatus.ASSIGNED) {
      redirectUrl.searchParams.set("error", "Заказ нельзя принять в текущем статусе.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    await Promise.all([
      db.coinServiceOrder.update({
        where: { id: order.id },
        data: {
          status: CoinServiceOrderStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      }),
      db.coinServiceExecutorAttempt.updateMany({
        where: {
          orderId: order.id,
          executorId: order.executorId ?? session.user.id,
          status: "ASSIGNED",
        },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
      }),
    ]);

    await createNotification({
      userId: order.buyerId,
      title: "Исполнитель принял заказ",
      body: `Заказ "${order.productTitle}" принят в работу.`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    });

    redirectUrl.searchParams.set("orderUpdated", "1");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (action === "executor_reject") {
    if (!admin && order.executorId !== session.user.id) {
      redirectUrl.searchParams.set("error", "Отказаться может только назначенный исполнитель.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (order.status !== CoinServiceOrderStatus.ASSIGNED) {
      redirectUrl.searchParams.set("error", "Отказаться можно только от назначенного заказа.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) {
      redirectUrl.searchParams.set("error", "Укажите причину отказа.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    const rejectedExecutorId = order.executorId ?? session.user.id;

    await db.coinServiceExecutorAttempt.updateMany({
      where: {
        orderId: order.id,
        executorId: rejectedExecutorId,
        status: "ASSIGNED",
      },
      data: {
        status: "REJECTED",
        reason,
        respondedAt: new Date(),
      },
    });

    await db.coinServiceOrderMessage.create({
      data: {
        orderId: order.id,
        senderId: rejectedExecutorId,
        body: `Отказ исполнителя. Причина: ${reason}`,
      },
    });

    const nextExecutor = await assignNextCoinServiceExecutor(order.id);
    const founders = await db.user.findMany({
      where: {
        role: UserRole.FOUNDER,
        isBanned: false,
      },
      select: { id: true },
    });

    await Promise.all([
      createNotificationsForUsers({
        userIds: [order.buyerId, ...founders.map((user) => user.id)],
        title: nextExecutor ? "Исполнитель отказался от заказа" : "Нет свободного исполнителя",
        body: nextExecutor
          ? `Заказ "${order.productTitle}" передан другому исполнителю. Причина отказа: ${reason}`
          : `Исполнитель отказался от заказа "${order.productTitle}", а других активных исполнителей нет. Причина: ${reason}`,
        type: NotificationType.SYSTEM,
        link: `/coins/orders/${order.id}`,
      }),
      nextExecutor
        ? createNotification({
            userId: nextExecutor.id,
            title: "Вам назначен заказ",
            body: `Новый заказ услуги: ${order.productTitle}. Примите его в работу или откажитесь с причиной.`,
            type: NotificationType.SYSTEM,
            link: `/coins/orders/${order.id}`,
          })
        : Promise.resolve(),
    ]);

    redirectUrl.searchParams.set("orderUpdated", "1");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (action === "executor_done") {
    if (order.executorId !== session.user.id) {
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
    if (order.buyerId !== session.user.id) {
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
