import { randomBytes } from "node:crypto";
import {
  Prisma,
  ShopDiscountType,
  ShopOrderActorType,
  ShopOrderStatus,
  ShopStockMode,
} from "@prisma/client";
import { db } from "@/lib/db";
import { defaultShopSettings, getShopAvailability } from "@/lib/shop/config";
import { encryptShopField, maskShopField } from "@/lib/shop/encryption";
import { ShopError } from "@/lib/shop/errors";
import { calculateShopQuote, type ShopPromoCodeQuote } from "@/lib/shop/pricing";
import { isForbiddenShopCredentialField } from "@/lib/shop/validators";

type CheckoutInput = {
  buyerId: string;
  variantId: string;
  quantity: number;
  promoCode?: string;
  fields: Record<string, string>;
  termsVersion: string;
  termsAccepted: true;
};

function orderNumber(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `DON-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function getActivePromotion(
  basePriceMinor: number,
  promotions: Array<{
    variantId: string | null;
    promotion: {
      isActive: boolean;
      startsAt: Date;
      endsAt: Date;
      discountType: ShopDiscountType;
      discountValue: number;
      maximumDiscountMinor: number | null;
    };
  }>,
  variantId: string,
  now: Date,
) {
  return promotions
    .filter(({ variantId: target, promotion }) =>
      (!target || target === variantId) && promotion.isActive && promotion.startsAt <= now && promotion.endsAt > now,
    )
    .map(({ promotion }) => {
      const rawDiscount = promotion.discountType === ShopDiscountType.PERCENT
        ? Math.floor((basePriceMinor * promotion.discountValue) / 100)
        : promotion.discountValue;
      const discountMinor = Math.min(
        basePriceMinor,
        promotion.maximumDiscountMinor ? Math.min(rawDiscount, promotion.maximumDiscountMinor) : rawDiscount,
      );
      return { salePriceMinor: basePriceMinor - discountMinor, promotion };
    })
    .sort((a, b) => a.salePriceMinor - b.salePriceMinor)[0] ?? null;
}

async function loadCheckoutData(tx: Prisma.TransactionClient, input: CheckoutInput, now: Date) {
  const [settings, buyer, variant] = await Promise.all([
    tx.shopSettings.findUnique({ where: { id: "default" } }),
    tx.user.findUnique({ where: { id: input.buyerId }, select: { id: true, telegramId: true, telegramUsername: true, isBanned: true, createdAt: true } }),
    tx.shopProductVariant.findFirst({
      where: { id: input.variantId, isActive: true, deletedAt: null, product: { isActive: true, deletedAt: null, category: { isActive: true, deletedAt: null } } },
      include: {
        product: {
          include: {
            category: true,
            fields: { orderBy: { sortOrder: "asc" } },
            promotions: { include: { promotion: true } },
          },
        },
      },
    }),
  ]);

  const resolvedSettings = settings ?? defaultShopSettings;
  const availability = getShopAvailability(resolvedSettings);
  if (!availability.available) throw new ShopError("SHOP_UNAVAILABLE", availability.reason, 503);
  if (!buyer || buyer.isBanned) throw new ShopError("BUYER_NOT_AVAILABLE", "Покупатель не найден или заблокирован.", 403);
  if (!buyer.telegramId) throw new ShopError("TELEGRAM_REQUIRED", "Перед покупкой привяжите Telegram в настройках безопасности.", 409);
  if (!variant) throw new ShopError("VARIANT_NOT_FOUND", "Выбранный вариант товара недоступен.", 404);
  if (!variant.quantityEnabled && input.quantity !== 1) {
    throw new ShopError("QUANTITY_NOT_ENABLED", "Only one unit can be ordered for this product.", 409);
  }
  if (input.quantity > variant.maxPerOrder) {
    throw new ShopError("QUANTITY_LIMIT", `The maximum quantity per order is ${variant.maxPerOrder}.`);
  }
  if (variant.stockMode === ShopStockMode.FINITE && variant.stockQuantity - variant.reservedQuantity < input.quantity) {
    throw new ShopError("OUT_OF_STOCK", "Недостаточно товара в наличии.", 409);
  }
  if (input.termsVersion !== resolvedSettings.termsVersion) {
    throw new ShopError("TERMS_CHANGED", "Правила магазина обновились. Прочитайте их и подтвердите снова.", 409);
  }

  const providedKeys = new Set(Object.keys(input.fields));
  const fieldValues = variant.product.fields.map((field) => {
    if (isForbiddenShopCredentialField(field)) {
      throw new ShopError("FORBIDDEN_CREDENTIAL_FIELD", "Этот товар настроен небезопасно: магазин не принимает пароли, одноразовые коды, токены или данные сессии.", 409);
    }
    const value = input.fields[field.key]?.trim() ?? "";
    providedKeys.delete(field.key);
    if (field.isRequired && !value) throw new ShopError("FIELD_REQUIRED", `Заполните поле «${field.label}».`);
    if (value.length > 2_000) throw new ShopError("FIELD_TOO_LONG", `Поле «${field.label}» слишком длинное.`);
    if (field.type === "SELECT" && value) {
      const options = Array.isArray(field.optionsJson) ? field.optionsJson.filter((option): option is string => typeof option === "string") : [];
      if (!options.includes(value)) throw new ShopError("FIELD_OPTION_INVALID", `Выберите допустимое значение для поля «${field.label}».`);
    }
    return { field, value };
  });
  if (providedKeys.size > 0) throw new ShopError("UNKNOWN_FIELDS", "Форма содержит поля, которых нет у товара.");

  const promotion = getActivePromotion(variant.priceMinor, variant.product.promotions, variant.id, now);
  let promoCode: Awaited<ReturnType<typeof resolvePromoCode>> | null = null;
  if (input.promoCode?.trim()) {
    promoCode = await resolvePromoCode(tx, {
      code: input.promoCode,
      buyerId: input.buyerId,
      buyerCreatedAt: buyer.createdAt,
      productId: variant.productId,
      categoryId: variant.product.categoryId,
      now,
    });
  }
  const promoQuote: ShopPromoCodeQuote | null = promoCode
    ? {
        kind: promoCode.discountType,
        value: promoCode.discountValue,
        minimumSubtotalMinor: promoCode.minimumSubtotalMinor,
        maximumDiscountMinor: promoCode.maximumDiscountMinor,
      }
    : null;
  const quote = calculateShopQuote({
    unitPriceMinor: variant.priceMinor,
    salePriceMinor: promotion?.salePriceMinor,
    saleStartsAt: promotion?.promotion.startsAt,
    saleEndsAt: promotion?.promotion.endsAt,
    quantity: input.quantity,
    promoCode: promoQuote,
  }, now);
  if (quote.totalMinor < resolvedSettings.minimumOrderMinor || quote.totalMinor > resolvedSettings.maximumOrderMinor) {
    throw new ShopError("ORDER_AMOUNT_LIMIT", "Сумма заказа находится вне разрешённых границ магазина.");
  }

  return { settings: resolvedSettings, buyer, variant, fieldValues, promotion, promoCode, quote };
}

async function resolvePromoCode(tx: Prisma.TransactionClient, input: {
  code: string;
  buyerId: string;
  buyerCreatedAt: Date;
  productId: string;
  categoryId: string;
  now: Date;
}) {
  const promo = await tx.shopPromoCode.findFirst({
    where: {
      code: input.code.trim().toUpperCase(),
      isActive: true,
      deletedAt: null,
      startsAt: { lte: input.now },
      endsAt: { gt: input.now },
    },
    include: { products: true, categories: true },
  });
  if (!promo) throw new ShopError("PROMO_NOT_FOUND", "Промокод не найден или срок его действия закончился.");
  if (promo.products.length > 0 && !promo.products.some((item) => item.productId === input.productId)) {
    throw new ShopError("PROMO_NOT_APPLICABLE", "Промокод не действует на выбранный товар.");
  }
  if (promo.categories.length > 0 && !promo.categories.some((item) => item.categoryId === input.categoryId)) {
    throw new ShopError("PROMO_NOT_APPLICABLE", "Промокод не действует на категорию товара.");
  }

  const activeUsageWhere: Prisma.ShopPromoCodeUsageWhereInput = {
    promoCodeId: promo.id,
    order: { status: { notIn: [ShopOrderStatus.CANCELLED, ShopOrderStatus.EXPIRED] } },
  };
  const [totalUsage, userUsage, previousOrders] = await Promise.all([
    tx.shopPromoCodeUsage.count({ where: activeUsageWhere }),
    tx.shopPromoCodeUsage.count({ where: { ...activeUsageWhere, userId: input.buyerId } }),
    promo.newUsersOnly
      ? tx.shopOrder.count({ where: { buyerId: input.buyerId, status: ShopOrderStatus.COMPLETED } })
      : Promise.resolve(0),
  ]);
  if (promo.totalUsageLimit !== null && totalUsage >= promo.totalUsageLimit) throw new ShopError("PROMO_LIMIT", "Лимит применений промокода исчерпан.");
  if (userUsage >= promo.perUserUsageLimit) throw new ShopError("PROMO_USER_LIMIT", "Вы уже использовали этот промокод максимально допустимое число раз.");
  if (promo.newUsersOnly && previousOrders > 0) throw new ShopError("PROMO_NEW_USERS_ONLY", "Промокод доступен только для первой покупки.");
  return promo;
}

export async function previewShopOrder(input: CheckoutInput) {
  return db.$transaction(async (tx) => {
    const data = await loadCheckoutData(tx, input, new Date());
    return {
      product: { id: data.variant.product.id, title: data.variant.product.title, slug: data.variant.product.slug },
      variant: { id: data.variant.id, name: data.variant.name, sku: data.variant.sku },
      quantity: input.quantity,
      estimatedMinutes: data.variant.estimatedMinutes ?? data.variant.product.estimatedMinutes,
      currency: data.settings.currency,
      quote: data.quote,
      termsVersion: data.settings.termsVersion,
    };
  });
}

export async function createShopOrder(input: CheckoutInput) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-variant:${input.variantId}`}))`;
    const now = new Date();
    const data = await loadCheckoutData(tx, input, now);
    const estimatedMinutes = data.variant.estimatedMinutes ?? data.variant.product.estimatedMinutes;
    const number = orderNumber(now);
    const created = await tx.shopOrder.create({
      data: {
        orderNumber: number,
        buyerId: input.buyerId,
        promoCodeId: data.promoCode?.id,
        status: ShopOrderStatus.PENDING_PAYMENT,
        currency: data.settings.currency,
        subtotalMinor: data.quote.subtotalMinor,
        promotionDiscountMinor: data.quote.promotionDiscountMinor,
        promoCodeDiscountMinor: data.quote.promoCodeDiscountMinor,
        totalMinor: data.quote.totalMinor,
        termsVersion: data.settings.termsVersion,
        termsAcceptedAt: now,
        paymentExpiresAt: new Date(now.getTime() + data.settings.paymentTimeoutMinutes * 60_000),
        items: {
          create: {
            productId: data.variant.product.id,
            variantId: data.variant.id,
            productTitle: data.variant.product.title,
            productSlug: data.variant.product.slug,
            variantName: data.variant.name,
            sku: data.variant.sku,
            quantity: input.quantity,
            baseUnitPriceMinor: data.quote.baseUnitPriceMinor,
            unitPriceMinor: data.quote.unitPriceMinor,
            promotionDiscountMinor: data.quote.promotionDiscountMinor,
            totalMinor: data.quote.subtotalMinor,
            estimatedMinutes,
          },
        },
        fieldValues: {
          create: data.fieldValues.filter(({ value }) => value).map(({ field, value }) => ({
            productFieldId: field.id,
            labelSnapshot: field.label,
            encryptedValue: encryptShopField(value),
            maskedValue: maskShopField(value),
          })),
        },
        statusHistory: {
          create: {
            actorUserId: input.buyerId,
            actorType: ShopOrderActorType.BUYER,
            previousStatus: ShopOrderStatus.PENDING_PAYMENT,
            newStatus: ShopOrderStatus.PENDING_PAYMENT,
            reason: "ORDER_CREATED",
          },
        },
      },
      include: { items: true, fieldValues: true },
    });

    if (data.variant.stockMode === ShopStockMode.FINITE) {
      await tx.shopProductVariant.update({
        where: { id: data.variant.id },
        data: { reservedQuantity: { increment: input.quantity } },
      });
    }
    if (data.promoCode && data.quote.promoCodeDiscountMinor > 0) {
      await tx.shopPromoCodeUsage.create({
        data: {
          promoCodeId: data.promoCode.id,
          userId: input.buyerId,
          orderId: created.id,
          amountMinor: data.quote.promoCodeDiscountMinor,
        },
      });
    }
    await tx.shopJob.create({
      data: {
        type: "EXPIRE_UNPAID_ORDER",
        dedupeKey: `expire-unpaid:${created.id}`,
        payload: { orderId: created.id },
        availableAt: created.paymentExpiresAt!,
      },
    });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
}
