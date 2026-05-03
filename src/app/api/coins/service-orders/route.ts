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
  paymentCardId: z.string().optional(),
  buyerTelegram: z.string().trim().min(3).max(200),
  konamiLogin: z.string().trim().min(3).max(200),
  konamiPassword: z.string().min(4).max(300),
  buyerComment: z.string().max(2000).optional(),
});

const receiptFileTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const receiptFileMaxSize = 8 * 1024 * 1024;

async function parseReceiptFile(file: File) {
  if (!receiptFileTypes.has(file.type)) {
    throw new Error("bad-type");
  }

  if (file.size <= 0 || file.size > receiptFileMaxSize) {
    throw new Error("bad-size");
  }

  return {
    fileName: file.name || "receipt",
    mimeType: file.type,
    size: file.size,
    data: Buffer.from(await file.arrayBuffer()),
  };
}

export async function POST(request: Request) {
  const session = await requireAuth();
  const formData = await request.formData();
  const productId = String(formData.get("productId") ?? "");
  const fallbackUrl = new URL(productId ? `/coins/services/${productId}` : "/coins", getRequestBaseUrl(request));
  const paymentReceiptFile = formData.get("paymentReceiptFile");
  const parsed = serviceOrderSchema.safeParse({
    productId,
    paymentCardId: formData.get("paymentCardId") ? String(formData.get("paymentCardId")) : "",
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

  const paymentCards = await db.coinPaymentCard.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (!paymentCards.length) {
    fallbackUrl.searchParams.set("error", "Оплата временно недоступна: администратор ещё не добавил карту.");
    return NextResponse.redirect(fallbackUrl, 303);
  }

  const selectedCard =
    paymentCards.find((card) => card.id === parsed.data.paymentCardId) ??
    paymentCards[Math.floor(Math.random() * paymentCards.length)];

  if (!(paymentReceiptFile instanceof File)) {
    fallbackUrl.searchParams.set("error", "Прикрепите чек оплаты файлом.");
    return NextResponse.redirect(fallbackUrl, 303);
  }

  let paymentReceipt: Awaited<ReturnType<typeof parseReceiptFile>>;

  try {
    paymentReceipt = await parseReceiptFile(paymentReceiptFile);
  } catch {
    fallbackUrl.searchParams.set("error", "Чек должен быть файлом PNG, JPG, WEBP или PDF до 8 МБ.");
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
      paymentBank: selectedCard.bank,
      paymentCard: selectedCard.cardNumber,
      paymentRecipient: selectedCard.recipient,
      paymentComment: settings.paymentComment || null,
      paymentReceiptFileName: paymentReceipt.fileName,
      paymentReceiptMimeType: paymentReceipt.mimeType,
      paymentReceiptSize: paymentReceipt.size,
      paymentReceiptData: paymentReceipt.data,
      paidAt: new Date(),
    },
  });

  await db.coinServiceOrder.update({
    where: { id: order.id },
    data: {
      paymentReceiptUrl: `/api/coins/service-orders/${order.id}/receipt`,
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
      title: "Новый оплаченный заказ",
      body: [
        `Покупатель: ${buyerName}`,
        `Услуга: ${product.title}`,
        `Сумма: ${formatKopecks(product.priceKopecks)}`,
        `Telegram: ${parsed.data.buyerTelegram}`,
        "Чек: прикреплён",
        "Статус: ожидает проверки оплаты",
      ].join("\n"),
      type: NotificationType.SYSTEM,
      link: "/admin/coins",
    }),
    createNotification({
      userId: session.user.id,
      title: "Заказ отправлен на проверку",
      body: `Заказ "${product.title}" отправлен администратору вместе с чеком оплаты.`,
      type: NotificationType.SYSTEM,
      link: `/coins/orders/${order.id}`,
    }),
  ]);

  const redirectUrl = new URL(`/coins/orders/${order.id}`, getRequestBaseUrl(request));
  redirectUrl.searchParams.set("created", "1");
  return NextResponse.redirect(redirectUrl, 303);
}
