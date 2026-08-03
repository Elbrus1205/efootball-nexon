-- CreateEnum
CREATE TYPE "ShopProductType" AS ENUM ('IN_GAME', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "ShopStockMode" AS ENUM ('FINITE', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "ShopProductFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'PLATFORM', 'REGION', 'LOGIN_METHOD', 'TIME');

-- CreateEnum
CREATE TYPE "ShopDiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "ShopOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'WAITING_SELLER', 'ACCEPTED', 'IN_PROGRESS', 'SELLER_COMPLETED', 'WAITING_BUYER_CONFIRMATION', 'COMPLETED', 'DISPUTE', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShopOrderActorType" AS ENUM ('BUYER', 'SELLER', 'SUPPORT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ShopOrderMessageVisibility" AS ENUM ('PARTICIPANTS', 'SUPPORT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ShopPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ShopRefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShopPayoutStatus" AS ENUM ('HELD', 'AVAILABLE', 'PROCESSING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShopReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ShopDisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShopNotificationChannel" AS ENUM ('IN_APP', 'TELEGRAM', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "ShopNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShopSellerDistributionMode" AS ENUM ('MANUAL', 'ROUND_ROBIN', 'LOWEST_LOAD', 'BEST_RATING', 'FASTEST');

-- CreateEnum
CREATE TYPE "ShopJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "TelegramCallbackToken" ADD COLUMN     "shopOrderId" TEXT;

-- CreateTable
CREATE TABLE "ShopCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ShopProductType" NOT NULL DEFAULT 'IN_GAME',
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fulfillmentTerms" TEXT NOT NULL,
    "faqJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "ratingAverage" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "stockMode" "ShopStockMode" NOT NULL DEFAULT 'FINITE',
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "maxPerOrder" INTEGER NOT NULL DEFAULT 10,
    "estimatedMinutes" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProductField" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" "ShopProductFieldType" NOT NULL DEFAULT 'TEXT',
    "placeholder" TEXT,
    "optionsJson" JSONB,
    "validationJson" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProductField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPromotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "ShopDiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maximumDiscountMinor" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "showCountdown" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPromotionProduct" (
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,

    CONSTRAINT "ShopPromotionProduct_pkey" PRIMARY KEY ("promotionId","productId")
);

-- CreateTable
CREATE TABLE "ShopOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT,
    "promoCodeId" TEXT,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "subtotalMinor" INTEGER NOT NULL,
    "promotionDiscountMinor" INTEGER NOT NULL DEFAULT 0,
    "promoCodeDiscountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "commissionMinor" INTEGER NOT NULL DEFAULT 0,
    "sellerEarningMinor" INTEGER NOT NULL DEFAULT 0,
    "termsVersion" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "paymentExpiresAt" TIMESTAMP(3),
    "sellerAcceptExpiresAt" TIMESTAMP(3),
    "fulfillmentExpiresAt" TIMESTAMP(3),
    "buyerConfirmationExpiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "sellerCompletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "baseUnitPriceMinor" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "promotionDiscountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderFieldValue" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productFieldId" TEXT NOT NULL,
    "labelSnapshot" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "maskedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOrderFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorType" "ShopOrderActorType" NOT NULL,
    "previousStatus" "ShopOrderStatus" NOT NULL,
    "newStatus" "ShopOrderStatus" NOT NULL,
    "comment" TEXT,
    "reason" TEXT,
    "technicalInfoJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "ShopOrderMessageVisibility" NOT NULL DEFAULT 'PARTICIPANTS',
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopOrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSeller" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "distributionMode" "ShopSellerDistributionMode" NOT NULL DEFAULT 'LOWEST_LOAD',
    "maxActiveOrders" INTEGER NOT NULL DEFAULT 3,
    "commissionBps" INTEGER NOT NULL DEFAULT 3000,
    "ratingAverage" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "averageFulfillmentMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastAssignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopSeller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSellerProduct" (
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopSellerProduct_pkey" PRIMARY KEY ("sellerId","productId")
);

-- CreateTable
CREATE TABLE "ShopSellerSchedule" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startsMinute" INTEGER NOT NULL,
    "endsMinute" INTEGER NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSellerSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ShopPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "checkoutUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "providerPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopPaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "externalRefundId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ShopRefundStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "reason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPayout" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "ShopPayoutStatus" NOT NULL DEFAULT 'HELD',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "availableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopReview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT,
    "buyerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ShopReviewStatus" NOT NULL DEFAULT 'PENDING',
    "buyerName" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "editableUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopReviewMedia" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopReviewMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopDispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "status" "ShopDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "desiredResolution" TEXT,
    "resolution" TEXT,
    "resolutionAmountMinor" INTEGER,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopDisputeMessage" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopDisputeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "ShopDiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "minimumSubtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "maximumDiscountMinor" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "totalUsageLimit" INTEGER,
    "perUserUsageLimit" INTEGER NOT NULL DEFAULT 1,
    "newUsersOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopPromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPromoCodeProduct" (
    "promoCodeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ShopPromoCodeProduct_pkey" PRIMARY KEY ("promoCodeId","productId")
);

-- CreateTable
CREATE TABLE "ShopPromoCodeCategory" (
    "promoCodeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ShopPromoCodeCategory_pkey" PRIMARY KEY ("promoCodeId","categoryId")
);

-- CreateTable
CREATE TABLE "ShopPromoCodeUsage" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopPromoCodeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopNotification" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT NOT NULL,
    "channel" "ShopNotificationChannel" NOT NULL,
    "event" TEXT NOT NULL,
    "status" "ShopNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "templateKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "orderId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "showHomeBlock" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "minimumOrderMinor" INTEGER NOT NULL DEFAULT 1000,
    "maximumOrderMinor" INTEGER NOT NULL DEFAULT 100000000,
    "paymentTimeoutMinutes" INTEGER NOT NULL DEFAULT 15,
    "sellerAcceptTimeoutMinutes" INTEGER NOT NULL DEFAULT 10,
    "fulfillmentTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "buyerConfirmTimeoutMinutes" INTEGER NOT NULL DEFAULT 1440,
    "autoCompleteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reviewEditWindowHours" INTEGER NOT NULL DEFAULT 24,
    "reviewModerationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewImagesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cancellationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showSellerToBuyer" BOOLEAN NOT NULL DEFAULT false,
    "defaultCommissionBps" INTEGER NOT NULL DEFAULT 3000,
    "supportTelegramChatId" TEXT,
    "reviewsTelegramChatId" TEXT,
    "supportContact" TEXT,
    "termsVersion" TEXT NOT NULL DEFAULT 'shop-draft-1',
    "legalTextsJson" JSONB,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ShopJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopCategory_slug_key" ON "ShopCategory"("slug");

-- CreateIndex
CREATE INDEX "ShopCategory_isActive_sortOrder_idx" ON "ShopCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ShopCategory_deletedAt_idx" ON "ShopCategory"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProduct_slug_key" ON "ShopProduct"("slug");

-- CreateIndex
CREATE INDEX "ShopProduct_categoryId_isActive_sortOrder_idx" ON "ShopProduct"("categoryId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ShopProduct_isFeatured_isActive_sortOrder_idx" ON "ShopProduct"("isFeatured", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ShopProduct_isPopular_purchaseCount_idx" ON "ShopProduct"("isPopular", "purchaseCount");

-- CreateIndex
CREATE INDEX "ShopProduct_deletedAt_idx" ON "ShopProduct"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProductVariant_sku_key" ON "ShopProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ShopProductVariant_productId_isActive_sortOrder_idx" ON "ShopProductVariant"("productId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ShopProductVariant_stockMode_stockQuantity_idx" ON "ShopProductVariant"("stockMode", "stockQuantity");

-- CreateIndex
CREATE INDEX "ShopProductVariant_deletedAt_idx" ON "ShopProductVariant"("deletedAt");

-- CreateIndex
CREATE INDEX "ShopProductImage_productId_sortOrder_idx" ON "ShopProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ShopProductField_productId_sortOrder_idx" ON "ShopProductField"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProductField_productId_key_key" ON "ShopProductField"("productId", "key");

-- CreateIndex
CREATE INDEX "ShopPromotion_isActive_startsAt_endsAt_idx" ON "ShopPromotion"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ShopPromotion_deletedAt_idx" ON "ShopPromotion"("deletedAt");

-- CreateIndex
CREATE INDEX "ShopPromotionProduct_productId_idx" ON "ShopPromotionProduct"("productId");

-- CreateIndex
CREATE INDEX "ShopPromotionProduct_variantId_idx" ON "ShopPromotionProduct"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_orderNumber_key" ON "ShopOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "ShopOrder_buyerId_createdAt_idx" ON "ShopOrder"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_sellerId_status_createdAt_idx" ON "ShopOrder"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_status_createdAt_idx" ON "ShopOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_paymentExpiresAt_status_idx" ON "ShopOrder"("paymentExpiresAt", "status");

-- CreateIndex
CREATE INDEX "ShopOrder_buyerConfirmationExpiresAt_status_idx" ON "ShopOrder"("buyerConfirmationExpiresAt", "status");

-- CreateIndex
CREATE INDEX "ShopOrderItem_orderId_idx" ON "ShopOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ShopOrderItem_productId_createdAt_idx" ON "ShopOrderItem"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrderItem_variantId_idx" ON "ShopOrderItem"("variantId");

-- CreateIndex
CREATE INDEX "ShopOrderFieldValue_orderId_idx" ON "ShopOrderFieldValue"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrderFieldValue_orderId_productFieldId_key" ON "ShopOrderFieldValue"("orderId", "productFieldId");

-- CreateIndex
CREATE INDEX "ShopOrderStatusHistory_orderId_createdAt_idx" ON "ShopOrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrderStatusHistory_actorUserId_createdAt_idx" ON "ShopOrderStatusHistory"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrderMessage_orderId_visibility_createdAt_idx" ON "ShopOrderMessage"("orderId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrderMessage_senderId_createdAt_idx" ON "ShopOrderMessage"("senderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopSeller_userId_key" ON "ShopSeller"("userId");

-- CreateIndex
CREATE INDEX "ShopSeller_isActive_isOnline_lastAssignedAt_idx" ON "ShopSeller"("isActive", "isOnline", "lastAssignedAt");

-- CreateIndex
CREATE INDEX "ShopSeller_deletedAt_idx" ON "ShopSeller"("deletedAt");

-- CreateIndex
CREATE INDEX "ShopSellerProduct_productId_isActive_idx" ON "ShopSellerProduct"("productId", "isActive");

-- CreateIndex
CREATE INDEX "ShopSellerSchedule_sellerId_dayOfWeek_isActive_idx" ON "ShopSellerSchedule"("sellerId", "dayOfWeek", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPayment_externalPaymentId_key" ON "ShopPayment"("externalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPayment_idempotencyKey_key" ON "ShopPayment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ShopPayment_orderId_status_idx" ON "ShopPayment"("orderId", "status");

-- CreateIndex
CREATE INDEX "ShopPayment_provider_status_createdAt_idx" ON "ShopPayment"("provider", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopPaymentWebhookEvent_status_createdAt_idx" ON "ShopPaymentWebhookEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPaymentWebhookEvent_provider_eventId_key" ON "ShopPaymentWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopRefund_externalRefundId_key" ON "ShopRefund"("externalRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopRefund_idempotencyKey_key" ON "ShopRefund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ShopRefund_orderId_status_idx" ON "ShopRefund"("orderId", "status");

-- CreateIndex
CREATE INDEX "ShopRefund_paymentId_status_idx" ON "ShopRefund"("paymentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPayout_orderId_key" ON "ShopPayout"("orderId");

-- CreateIndex
CREATE INDEX "ShopPayout_sellerId_status_availableAt_idx" ON "ShopPayout"("sellerId", "status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopReview_orderId_key" ON "ShopReview"("orderId");

-- CreateIndex
CREATE INDEX "ShopReview_productId_status_createdAt_idx" ON "ShopReview"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopReview_sellerId_status_createdAt_idx" ON "ShopReview"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopReview_buyerId_createdAt_idx" ON "ShopReview"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopReviewMedia_reviewId_sortOrder_idx" ON "ShopReviewMedia"("reviewId", "sortOrder");

-- CreateIndex
CREATE INDEX "ShopDispute_orderId_status_createdAt_idx" ON "ShopDispute"("orderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopDispute_status_createdAt_idx" ON "ShopDispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopDisputeMessage_disputeId_createdAt_idx" ON "ShopDisputeMessage"("disputeId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopDisputeMessage_senderId_createdAt_idx" ON "ShopDisputeMessage"("senderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPromoCode_code_key" ON "ShopPromoCode"("code");

-- CreateIndex
CREATE INDEX "ShopPromoCode_isActive_startsAt_endsAt_idx" ON "ShopPromoCode"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ShopPromoCode_deletedAt_idx" ON "ShopPromoCode"("deletedAt");

-- CreateIndex
CREATE INDEX "ShopPromoCodeProduct_productId_idx" ON "ShopPromoCodeProduct"("productId");

-- CreateIndex
CREATE INDEX "ShopPromoCodeCategory_categoryId_idx" ON "ShopPromoCodeCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPromoCodeUsage_orderId_key" ON "ShopPromoCodeUsage"("orderId");

-- CreateIndex
CREATE INDEX "ShopPromoCodeUsage_promoCodeId_createdAt_idx" ON "ShopPromoCodeUsage"("promoCodeId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopPromoCodeUsage_promoCodeId_userId_createdAt_idx" ON "ShopPromoCodeUsage"("promoCodeId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopPromoCodeUsage_userId_createdAt_idx" ON "ShopPromoCodeUsage"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopNotification_dedupeKey_key" ON "ShopNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "ShopNotification_status_availableAt_idx" ON "ShopNotification"("status", "availableAt");

-- CreateIndex
CREATE INDEX "ShopNotification_userId_createdAt_idx" ON "ShopNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopNotification_orderId_event_idx" ON "ShopNotification"("orderId", "event");

-- CreateIndex
CREATE INDEX "ShopAuditLog_entityType_entityId_createdAt_idx" ON "ShopAuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopAuditLog_actorUserId_createdAt_idx" ON "ShopAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopAuditLog_orderId_createdAt_idx" ON "ShopAuditLog"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopJob_dedupeKey_key" ON "ShopJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "ShopJob_status_availableAt_idx" ON "ShopJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "ShopJob_type_status_idx" ON "ShopJob"("type", "status");

-- CreateIndex
CREATE INDEX "TelegramCallbackToken_shopOrderId_action_idx" ON "TelegramCallbackToken"("shopOrderId", "action");

-- AddForeignKey
ALTER TABLE "TelegramCallbackToken" ADD CONSTRAINT "TelegramCallbackToken_shopOrderId_fkey" FOREIGN KEY ("shopOrderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShopCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProductVariant" ADD CONSTRAINT "ShopProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProductImage" ADD CONSTRAINT "ShopProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProductField" ADD CONSTRAINT "ShopProductField_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromotionProduct" ADD CONSTRAINT "ShopPromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "ShopPromotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromotionProduct" ADD CONSTRAINT "ShopPromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "ShopSeller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "ShopPromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ShopProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderFieldValue" ADD CONSTRAINT "ShopOrderFieldValue_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderFieldValue" ADD CONSTRAINT "ShopOrderFieldValue_productFieldId_fkey" FOREIGN KEY ("productFieldId") REFERENCES "ShopProductField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderStatusHistory" ADD CONSTRAINT "ShopOrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderStatusHistory" ADD CONSTRAINT "ShopOrderStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderMessage" ADD CONSTRAINT "ShopOrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderMessage" ADD CONSTRAINT "ShopOrderMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSeller" ADD CONSTRAINT "ShopSeller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSellerProduct" ADD CONSTRAINT "ShopSellerProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "ShopSeller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSellerProduct" ADD CONSTRAINT "ShopSellerProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSellerSchedule" ADD CONSTRAINT "ShopSellerSchedule_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "ShopSeller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPayment" ADD CONSTRAINT "ShopPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRefund" ADD CONSTRAINT "ShopRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRefund" ADD CONSTRAINT "ShopRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ShopPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPayout" ADD CONSTRAINT "ShopPayout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPayout" ADD CONSTRAINT "ShopPayout_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "ShopSeller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "ShopSeller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopReviewMedia" ADD CONSTRAINT "ShopReviewMedia_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ShopReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopDispute" ADD CONSTRAINT "ShopDispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopDispute" ADD CONSTRAINT "ShopDispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopDisputeMessage" ADD CONSTRAINT "ShopDisputeMessage_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "ShopDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopDisputeMessage" ADD CONSTRAINT "ShopDisputeMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromoCodeProduct" ADD CONSTRAINT "ShopPromoCodeProduct_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "ShopPromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromoCodeProduct" ADD CONSTRAINT "ShopPromoCodeProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromoCodeCategory" ADD CONSTRAINT "ShopPromoCodeCategory_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "ShopPromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromoCodeCategory" ADD CONSTRAINT "ShopPromoCodeCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShopCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromoCodeUsage" ADD CONSTRAINT "ShopPromoCodeUsage_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "ShopPromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromoCodeUsage" ADD CONSTRAINT "ShopPromoCodeUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPromoCodeUsage" ADD CONSTRAINT "ShopPromoCodeUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopNotification" ADD CONSTRAINT "ShopNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopNotification" ADD CONSTRAINT "ShopNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAuditLog" ADD CONSTRAINT "ShopAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAuditLog" ADD CONSTRAINT "ShopAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants that Prisma cannot express in the schema.
ALTER TABLE "ShopProductVariant" ADD CONSTRAINT "ShopProductVariant_money_stock_check"
  CHECK ("priceMinor" >= 0 AND "stockQuantity" >= 0 AND "reservedQuantity" >= 0 AND "reservedQuantity" <= "stockQuantity" AND "maxPerOrder" > 0);
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_money_check"
  CHECK ("subtotalMinor" >= 0 AND "promotionDiscountMinor" >= 0 AND "promoCodeDiscountMinor" >= 0 AND "totalMinor" >= 0 AND "totalMinor" <= "subtotalMinor" AND "commissionMinor" >= 0 AND "sellerEarningMinor" >= 0);
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_money_quantity_check"
  CHECK ("quantity" > 0 AND "baseUnitPriceMinor" >= 0 AND "unitPriceMinor" >= 0 AND "promotionDiscountMinor" >= 0 AND "totalMinor" >= 0 AND "estimatedMinutes" > 0);
ALTER TABLE "ShopSeller" ADD CONSTRAINT "ShopSeller_limits_check"
  CHECK ("maxActiveOrders" > 0 AND "commissionBps" BETWEEN 0 AND 10000 AND "completedOrders" >= 0 AND "averageFulfillmentMinutes" >= 0);
ALTER TABLE "ShopSellerSchedule" ADD CONSTRAINT "ShopSellerSchedule_window_check"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6 AND "startsMinute" >= 0 AND "endsMinute" <= 1440 AND "startsMinute" < "endsMinute");
ALTER TABLE "ShopPayment" ADD CONSTRAINT "ShopPayment_amount_check" CHECK ("amountMinor" >= 0);
ALTER TABLE "ShopRefund" ADD CONSTRAINT "ShopRefund_amount_check" CHECK ("amountMinor" > 0);
ALTER TABLE "ShopPayout" ADD CONSTRAINT "ShopPayout_amount_check" CHECK ("amountMinor" >= 0);
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "ShopPromotion" ADD CONSTRAINT "ShopPromotion_window_discount_check"
  CHECK ("endsAt" > "startsAt" AND "discountValue" > 0 AND ("discountType" <> 'PERCENT' OR "discountValue" <= 100));
ALTER TABLE "ShopPromoCode" ADD CONSTRAINT "ShopPromoCode_window_discount_check"
  CHECK ("endsAt" > "startsAt" AND "discountValue" > 0 AND ("discountType" <> 'PERCENT' OR "discountValue" <= 100) AND "minimumSubtotalMinor" >= 0 AND "perUserUsageLimit" > 0);
ALTER TABLE "ShopSettings" ADD CONSTRAINT "ShopSettings_limits_check"
  CHECK ("minimumOrderMinor" >= 0 AND "maximumOrderMinor" >= "minimumOrderMinor" AND "paymentTimeoutMinutes" > 0 AND "sellerAcceptTimeoutMinutes" > 0 AND "fulfillmentTimeoutMinutes" > 0 AND "buyerConfirmTimeoutMinutes" > 0 AND "defaultCommissionBps" BETWEEN 0 AND 10000);

-- Supabase clients have no direct access to shop tables. All reads and writes
-- go through authenticated Next.js server modules where contextual RBAC applies.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ShopCategory', 'ShopProduct', 'ShopProductVariant', 'ShopProductImage',
    'ShopProductField', 'ShopPromotion', 'ShopPromotionProduct', 'ShopOrder',
    'ShopOrderItem', 'ShopOrderFieldValue', 'ShopOrderStatusHistory',
    'ShopOrderMessage', 'ShopSeller', 'ShopSellerProduct', 'ShopSellerSchedule',
    'ShopPayment', 'ShopPaymentWebhookEvent', 'ShopRefund', 'ShopPayout',
    'ShopReview', 'ShopReviewMedia', 'ShopDispute', 'ShopDisputeMessage',
    'ShopPromoCode', 'ShopPromoCodeProduct', 'ShopPromoCodeCategory',
    'ShopPromoCodeUsage', 'ShopNotification', 'ShopAuditLog', 'ShopSettings',
    'ShopJob'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY deny_all_public_access ON public.%I AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false)',
      table_name
    );
  END LOOP;
END $$;
