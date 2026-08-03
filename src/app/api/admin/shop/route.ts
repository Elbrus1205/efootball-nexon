import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ShopProductFieldType, ShopProductType } from "@prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { getShopAdminDashboard, recalculateProductRating } from "@/lib/shop/admin";
import { parseShopMoneyToMinor } from "@/lib/shop/format";
import { isForbiddenShopCredentialField } from "@/lib/shop/validators";
import { resolveShopDispute } from "@/lib/shop/order-workflow-service";
import { parseCommissionPercent, parseShopStockInput } from "@/lib/shop/admin-input";
import { parseMoscowDateTimeLocal } from "@/lib/utils";

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function integer(form: FormData, key: string, fallback = 0) {
  const value = Number.parseInt(text(form, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function redirectToAdmin(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/shop", getRequestBaseUrl(request));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: Request) {
  await requirePermission("shop.support");
  const days = Number.parseInt(new URL(request.url).searchParams.get("days") ?? "30", 10);
  return NextResponse.json(await getShopAdminDashboard(days));
}

export async function POST(request: Request) {
  const form = await request.formData();
  const action = text(form, "_action");
  const manageActions = new Set(["saveSettings", "createCategory", "updateCategory", "createProduct", "updateProduct", "toggleProduct", "createField", "updateField", "addSeller", "updateSeller", "toggleSeller", "assignSellerProduct", "createPromotion", "updatePromotion", "createPromoCode", "updatePromoCode", "moderateReview"]);
  const session = await requirePermission(manageActions.has(action) ? "shop.manage" : "shop.support");
  try {
    if (action === "saveSettings") {
      await db.shopSettings.upsert({
        where: { id: "default" },
        create: {
          isEnabled: form.get("isEnabled") === "true",
          maintenanceMode: form.get("maintenanceMode") === "true",
          showHomeBlock: form.get("showHomeBlock") === "true",
          currency: text(form, "currency") || "RUB",
          minimumOrderMinor: parseShopMoneyToMinor(text(form, "minimumOrder") || "10"),
          maximumOrderMinor: parseShopMoneyToMinor(text(form, "maximumOrder") || "1000000"),
          paymentTimeoutMinutes: integer(form, "paymentTimeoutMinutes", 15),
          sellerAcceptTimeoutMinutes: integer(form, "sellerAcceptTimeoutMinutes", 10),
          fulfillmentTimeoutMinutes: integer(form, "fulfillmentTimeoutMinutes", 60),
          buyerConfirmTimeoutMinutes: integer(form, "buyerConfirmTimeoutMinutes", 1440),
          autoCompleteEnabled: form.get("autoCompleteEnabled") === "true",
          cancellationEnabled: form.get("cancellationEnabled") === "true",
          reviewModerationEnabled: form.get("reviewModerationEnabled") === "true",
          supportContact: text(form, "supportContact") || null,
          termsVersion: text(form, "termsVersion") || "shop-draft-1",
          updatedById: session.user.id,
        },
        update: {
          isEnabled: form.get("isEnabled") === "true",
          maintenanceMode: form.get("maintenanceMode") === "true",
          showHomeBlock: form.get("showHomeBlock") === "true",
          currency: text(form, "currency") || "RUB",
          minimumOrderMinor: parseShopMoneyToMinor(text(form, "minimumOrder") || "10"),
          maximumOrderMinor: parseShopMoneyToMinor(text(form, "maximumOrder") || "1000000"),
          paymentTimeoutMinutes: integer(form, "paymentTimeoutMinutes", 15),
          sellerAcceptTimeoutMinutes: integer(form, "sellerAcceptTimeoutMinutes", 10),
          fulfillmentTimeoutMinutes: integer(form, "fulfillmentTimeoutMinutes", 60),
          buyerConfirmTimeoutMinutes: integer(form, "buyerConfirmTimeoutMinutes", 1440),
          autoCompleteEnabled: form.get("autoCompleteEnabled") === "true",
          cancellationEnabled: form.get("cancellationEnabled") === "true",
          reviewModerationEnabled: form.get("reviewModerationEnabled") === "true",
          supportContact: text(form, "supportContact") || null,
          termsVersion: text(form, "termsVersion") || "shop-draft-1",
          updatedById: session.user.id,
        },
      });
    } else if (action === "createCategory") {
      await db.shopCategory.create({ data: { name: text(form, "name"), slug: text(form, "slug").toLowerCase(), description: text(form, "description") || null, sortOrder: integer(form, "sortOrder"), createdById: session.user.id } });
    } else if (action === "updateCategory") {
      const id = text(form, "id");
      await db.shopCategory.update({ where: { id }, data: { name: text(form, "name"), slug: text(form, "slug").toLowerCase(), description: text(form, "description") || null, sortOrder: integer(form, "sortOrder"), isActive: form.get("isActive") === "true", updatedById: session.user.id } });
      await db.shopAuditLog.create({ data: { actorUserId: session.user.id, entityType: "ShopCategory", entityId: id, action: "UPDATE" } });
    } else if (action === "createProduct") {
      const priceMinor = parseShopMoneyToMinor(text(form, "price"));
      const stock = parseShopStockInput({ unlimited: form.get("unlimited") === "true", stockQuantity: text(form, "stockQuantity") || "0" });
      const product = await db.shopProduct.create({
        data: {
          categoryId: text(form, "categoryId"),
          slug: text(form, "slug").toLowerCase(),
          type: text(form, "type") === "PROMOTIONAL" ? ShopProductType.PROMOTIONAL : ShopProductType.IN_GAME,
          title: text(form, "title"),
          shortDescription: text(form, "shortDescription"),
          description: text(form, "description"),
          fulfillmentTerms: text(form, "fulfillmentTerms"),
          estimatedMinutes: integer(form, "estimatedMinutes", 30),
          isActive: form.get("isActive") === "true",
          isFeatured: form.get("isFeatured") === "true",
          isPopular: form.get("isPopular") === "true",
          createdById: session.user.id,
          images: text(form, "imageUrl") ? { create: { url: text(form, "imageUrl"), alt: text(form, "title") } } : undefined,
          variants: { create: { sku: text(form, "sku").toUpperCase(), name: text(form, "variantName") || "Стандартный", priceMinor, ...stock, maxPerOrder: integer(form, "maxPerOrder", 10), estimatedMinutes: integer(form, "estimatedMinutes", 30), isDefault: true, createdById: session.user.id } },
        },
      });
      await db.shopAuditLog.create({ data: { actorUserId: session.user.id, entityType: "ShopProduct", entityId: product.id, action: "CREATE", afterJson: { title: product.title, slug: product.slug, priceMinor } } });
    } else if (action === "updateProduct") {
      const id = text(form, "id");
      const variantId = text(form, "variantId");
      const priceMinor = parseShopMoneyToMinor(text(form, "price"));
      const stock = parseShopStockInput({ unlimited: form.get("unlimited") === "true", stockQuantity: text(form, "stockQuantity") || "0" });
      const imageUrl = text(form, "imageUrl");
      await db.$transaction(async (tx) => {
        await tx.shopProduct.update({ where: { id }, data: { categoryId: text(form, "categoryId"), slug: text(form, "slug").toLowerCase(), type: text(form, "type") === "PROMOTIONAL" ? ShopProductType.PROMOTIONAL : ShopProductType.IN_GAME, title: text(form, "title"), shortDescription: text(form, "shortDescription"), description: text(form, "description"), fulfillmentTerms: text(form, "fulfillmentTerms"), estimatedMinutes: integer(form, "estimatedMinutes", 30), isActive: form.get("isActive") === "true", isFeatured: form.get("isFeatured") === "true", isPopular: form.get("isPopular") === "true", updatedById: session.user.id } });
        await tx.shopProductVariant.update({ where: { id: variantId }, data: { sku: text(form, "sku").toUpperCase(), name: text(form, "variantName") || "Стандартный", priceMinor, ...stock, maxPerOrder: integer(form, "maxPerOrder", 10), estimatedMinutes: integer(form, "estimatedMinutes", 30), updatedById: session.user.id } });
        const currentImage = await tx.shopProductImage.findFirst({ where: { productId: id }, orderBy: { sortOrder: "asc" } });
        if (imageUrl && currentImage) await tx.shopProductImage.update({ where: { id: currentImage.id }, data: { url: imageUrl, alt: text(form, "title") } });
        else if (imageUrl) await tx.shopProductImage.create({ data: { productId: id, url: imageUrl, alt: text(form, "title") } });
        else await tx.shopProductImage.deleteMany({ where: { productId: id } });
        await tx.shopAuditLog.create({ data: { actorUserId: session.user.id, entityType: "ShopProduct", entityId: id, action: "UPDATE", afterJson: { title: text(form, "title"), slug: text(form, "slug"), priceMinor, stockMode: stock.stockMode, stockQuantity: stock.stockQuantity } } });
      });
    } else if (action === "toggleProduct") {
      const id = text(form, "id");
      const current = await db.shopProduct.findUniqueOrThrow({ where: { id } });
      await db.shopProduct.update({ where: { id }, data: { isActive: !current.isActive, updatedById: session.user.id } });
    } else if (action === "createField") {
      const fieldIdentity = { key: text(form, "key"), label: text(form, "label") };
      if (isForbiddenShopCredentialField(fieldIdentity)) {
        throw new Error("Нельзя создавать поля для пароля, одноразового кода, токена или данных сессии.");
      }
      await db.shopProductField.create({ data: { productId: text(form, "productId"), ...fieldIdentity, description: text(form, "description") || null, type: (text(form, "fieldType") || "TEXT") as ShopProductFieldType, isRequired: form.get("isRequired") === "true", isSensitive: form.get("isSensitive") === "true", sortOrder: integer(form, "sortOrder") } });
    } else if (action === "updateField") {
      const id = text(form, "id");
      const fieldIdentity = { key: text(form, "key") || undefined, label: text(form, "label") };
      if (isForbiddenShopCredentialField({ key: fieldIdentity.key ?? "", label: fieldIdentity.label })) throw new Error("Нельзя создавать поля для пароля, одноразового кода, токена или данных сессии.");
      await db.shopProductField.update({ where: { id }, data: { ...(fieldIdentity.key ? { key: fieldIdentity.key } : {}), label: fieldIdentity.label, description: text(form, "description") || null, isRequired: form.get("isRequired") === "true" } });
    } else if (action === "addSeller") {
      const publicId = text(form, "publicId");
      const user = await db.user.findUnique({ where: { publicId } });
      if (!user) throw new Error("Пользователь с таким публичным ID не найден.");
      const commissionBps = parseCommissionPercent(text(form, "commissionPercent") || "30");
      await db.shopSeller.upsert({ where: { userId: user.id }, create: { userId: user.id, maxActiveOrders: integer(form, "maxActiveOrders", 3), commissionBps }, update: { isActive: true, deletedAt: null, maxActiveOrders: integer(form, "maxActiveOrders", 3), commissionBps } });
    } else if (action === "updateSeller") {
      const id = text(form, "id");
      await db.shopSeller.update({ where: { id }, data: { isActive: form.get("isActive") === "true", maxActiveOrders: integer(form, "maxActiveOrders", 3), commissionBps: parseCommissionPercent(text(form, "commissionPercent") || "30") } });
      await db.shopAuditLog.create({ data: { actorUserId: session.user.id, entityType: "ShopSeller", entityId: id, action: "UPDATE" } });
    } else if (action === "toggleSeller") {
      const id = text(form, "id");
      const seller = await db.shopSeller.findUniqueOrThrow({ where: { id } });
      await db.shopSeller.update({ where: { id }, data: { isActive: !seller.isActive } });
    } else if (action === "assignSellerProduct") {
      await db.shopSellerProduct.upsert({
        where: { sellerId_productId: { sellerId: text(form, "sellerId"), productId: text(form, "productId") } },
        create: { sellerId: text(form, "sellerId"), productId: text(form, "productId") },
        update: { isActive: true },
      });
    } else if (action === "createPromotion") {
      const discountType = text(form, "discountType") === "FIXED" ? "FIXED" : "PERCENT";
      const promotion = await db.shopPromotion.create({
        data: {
          name: text(form, "name"),
          description: text(form, "description") || null,
          discountType,
          discountValue: discountType === "FIXED" ? parseShopMoneyToMinor(text(form, "discountValue")) : integer(form, "discountValue"),
          startsAt: parseMoscowDateTimeLocal(text(form, "startsAt")),
          endsAt: parseMoscowDateTimeLocal(text(form, "endsAt")),
          showCountdown: form.get("showCountdown") === "true",
          createdById: session.user.id,
          products: { create: { productId: text(form, "productId") } },
        },
      });
      await db.shopAuditLog.create({ data: { actorUserId: session.user.id, entityType: "ShopPromotion", entityId: promotion.id, action: "CREATE" } });
    } else if (action === "updatePromotion") {
      const id = text(form, "id");
      const discountType = text(form, "discountType") === "FIXED" ? "FIXED" : "PERCENT";
      await db.$transaction(async (tx) => {
        await tx.shopPromotion.update({ where: { id }, data: { name: text(form, "name"), description: form.has("description") ? text(form, "description") || null : undefined, discountType, discountValue: discountType === "FIXED" ? parseShopMoneyToMinor(text(form, "discountValue")) : integer(form, "discountValue"), startsAt: parseMoscowDateTimeLocal(text(form, "startsAt")), endsAt: parseMoscowDateTimeLocal(text(form, "endsAt")), isActive: form.get("isActive") === "true", showCountdown: form.get("showCountdown") === "true", updatedById: session.user.id } });
        await tx.shopPromotionProduct.deleteMany({ where: { promotionId: id } });
        await tx.shopPromotionProduct.create({ data: { promotionId: id, productId: text(form, "productId") } });
        await tx.shopAuditLog.create({ data: { actorUserId: session.user.id, entityType: "ShopPromotion", entityId: id, action: "UPDATE" } });
      });
    } else if (action === "createPromoCode") {
      const discountType = text(form, "discountType") === "FIXED" ? "FIXED" : "PERCENT";
      await db.shopPromoCode.create({
        data: {
          code: text(form, "code").toUpperCase(),
          description: text(form, "description") || null,
          discountType,
          discountValue: discountType === "FIXED" ? parseShopMoneyToMinor(text(form, "discountValue")) : integer(form, "discountValue"),
          minimumSubtotalMinor: parseShopMoneyToMinor(text(form, "minimumSubtotal") || "0"),
          startsAt: parseMoscowDateTimeLocal(text(form, "startsAt")),
          endsAt: parseMoscowDateTimeLocal(text(form, "endsAt")),
          totalUsageLimit: text(form, "totalUsageLimit") ? integer(form, "totalUsageLimit") : null,
          perUserUsageLimit: integer(form, "perUserUsageLimit", 1),
          newUsersOnly: form.get("newUsersOnly") === "true",
          createdById: session.user.id,
        },
      });
    } else if (action === "updatePromoCode") {
      const id = text(form, "id");
      const discountType = text(form, "discountType") === "FIXED" ? "FIXED" : "PERCENT";
      await db.shopPromoCode.update({ where: { id }, data: { code: text(form, "code").toUpperCase(), description: form.has("description") ? text(form, "description") || null : undefined, discountType, discountValue: discountType === "FIXED" ? parseShopMoneyToMinor(text(form, "discountValue")) : integer(form, "discountValue"), minimumSubtotalMinor: parseShopMoneyToMinor(text(form, "minimumSubtotal") || "0"), startsAt: parseMoscowDateTimeLocal(text(form, "startsAt")), endsAt: parseMoscowDateTimeLocal(text(form, "endsAt")), totalUsageLimit: text(form, "totalUsageLimit") ? integer(form, "totalUsageLimit") : null, perUserUsageLimit: integer(form, "perUserUsageLimit", 1), newUsersOnly: form.get("newUsersOnly") === "true", isActive: form.get("isActive") === "true", updatedById: session.user.id } });
      await db.shopAuditLog.create({ data: { actorUserId: session.user.id, entityType: "ShopPromoCode", entityId: id, action: "UPDATE" } });
    } else if (action === "moderateReview") {
      const id = text(form, "id");
      const review = await db.shopReview.update({ where: { id }, data: { status: form.get("approve") === "true" ? "PUBLISHED" : "REJECTED", publishedAt: form.get("approve") === "true" ? new Date() : null } });
      await recalculateProductRating(review.productId);
    } else if (action === "resolveDispute") {
      const targetStatus = text(form, "targetStatus");
      if (!["COMPLETED", "REFUND_PENDING", "IN_PROGRESS", "CANCELLED"].includes(targetStatus)) throw new Error("Недопустимый исход спора.");
      const refundValue = text(form, "refundAmount");
      await resolveShopDispute({
        orderId: text(form, "orderId"),
        userId: session.user.id,
        resolution: text(form, "resolution"),
        targetStatus: targetStatus as "COMPLETED" | "REFUND_PENDING" | "IN_PROGRESS" | "CANCELLED",
        refundAmountMinor: refundValue ? parseShopMoneyToMinor(refundValue) : undefined,
      });
    } else {
      throw new Error("Неизвестное действие магазина.");
    }
    revalidatePath("/shop");
    revalidatePath("/admin/shop");
    return redirectToAdmin(request, { saved: "1" });
  } catch (error) {
    console.error("Admin shop action failed", error);
    return redirectToAdmin(request, { error: error instanceof Error ? error.message : "Не удалось сохранить изменения." });
  }
}
