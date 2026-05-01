import { NextResponse } from "next/server";
import { NotificationType, UserRole } from "@prisma/client";
import { z } from "zod";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { calculatePercentAmount, formatKopecks, getCoinStoreSettings } from "@/lib/coin-services";
import { createNotification, createNotificationsForUsers } from "@/lib/services/notifications";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

const telegramContactRegex = /^(?:@[\w_]{5,32}|(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_]{5,32}\/?)$/i;

const serviceOrderSchema = z.object({
  productId: z.string().min(1),
  buyerTelegram: z.string().trim().min(3).max(200),
  konamiLogin: z.string().trim().min(3).max(200),
  konamiPassword: z.string().min(4).max(300),
  buyerComment: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const session = await requireAuth();
  const formData = await request.formData();
  const productId = String(formData.get("productId") ?? "");
  const fallbackUrl = new URL(productId ? `/coins/services/${productId}` : "/coins", getRequestBaseUrl(request));
  const parsed = serviceOrderSchema.safeParse({
    productId,
    buyerTelegram: formData.get("buyerTelegram"),
    konamiLogin: formData.get("konamiLogin"),
    konamiPassword: formData.get("konamiPassword"),
    buyerComment: formData.get("buyerComment") ?? "",
  });

  if (!parsed.success) {
    fallbackUrl.searchParams.set("error", "Проверьте данные заказа.");
    return NextResponse.redirect(fallbackUrl, 303);
  }

  if (!telegramContactRegex.test(parsed.data.buyerTelegram)) {
    fallbackUrl.searchParams.set("error", "Укажите Telegram в формате @username или t.me/username.");
    return NextResponse.redirect(fallbackUrl, 303);
  }

  const settings = await getCoinStoreSettings();

  if (!settings.servicesStoreEnabled) {
    fallbackUrl.searchParams.set("error", "Магазин услуг сейчас выключен.");
    return NextResponse.redirect(fallbackUrl, 303);
  }

  const product = await db.coinServiceProduct.findFirst({
    where: {
      id: parsed.data.productId,
      isActive: true,
    },
  });

  if (!product) {
    fallbackUrl.searchParams.set("error", "Услуга не найдена.");
    return NextResponse.redirect(fallbackUrl, 303);
  }

  const executorEarningKopecks = calculatePercentAmount(product.priceKopecks, product.executorPercent);
  const ownerEarningKopecks = calculatePercentAmount(product.priceKopecks, product.ownerPercent);
  const order = await db.coinServiceOrder.create({
    data: {
      productId: product.id,
      buyerId: session.user.id,
      productTitle: product.title,
      productDescription: product.description,
      priceKopecks: product.priceKopecks,
      executorPercent: product.executorPercent,
      ownerPercent: product.ownerPercent,
      executorEarningKopecks,
      ownerEarningKopecks,
      buyerTelegram: parsed.data.buyerTelegram,
      konamiLogin: parsed.data.konamiLogin,
      konamiPassword: parsed.data.konamiPassword,
      buyerComment: parsed.data.buyerComment?.trim() || null,
      paymentCard: settings.paymentCard || null,
      paymentRecipient: settings.paymentRecipient || null,
      paymentComment: settings.paymentComment || null,
    },
  });

  const buyerName = session.user.nickname || session.user.name || session.user.email || "Покупатель";
  const founders = await db.user.findMany({
    where: {
      role: UserRole.FOUNDER,
      isBanned: false,
    },
    select: { id: true },
  });

  await Promise.all([
    createNotificationsForUsers({
      userIds: founders.map((user) => user.id),
      title: "Новый заказ услуги",
      body: `${buyerName} заказал: ${product.title}. Сумма: ${formatKopecks(product.priceKopecks)}.`,
      type: NotificationType.SYSTEM,
      link: "/admin/coins",
    }),
    createNotification({
      userId: session.user.id,
      title: "Заказ создан",
      body: `Заказ "${product.title}" отправлен администратору. Оплатите ${formatKopecks(product.priceKopecks)} по указанным реквизитам.`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    }),
  ]);

  const redirectUrl = new URL(`/coins/orders/${order.id}`, getRequestBaseUrl(request));
  redirectUrl.searchParams.set("created", "1");
  return NextResponse.redirect(redirectUrl, 303);
}

