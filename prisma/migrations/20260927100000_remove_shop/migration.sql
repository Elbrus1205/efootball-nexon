-- The shop is permanently removed from the application.
-- Drop dependent tables first through CASCADE so existing installations are cleaned up safely.
DROP TABLE IF EXISTS "ShopReviewMedia", "ShopReview", "ShopDisputeMessage", "ShopDispute", "ShopPromoCodeUsage", "ShopPromoCodeProduct", "ShopPromoCodeCategory", "ShopPromoCode", "ShopNotification", "ShopAuditLog", "ShopRefund", "ShopPaymentWebhookEvent", "ShopPayment", "ShopPayout", "ShopOrderMessage", "ShopOrderStatusHistory", "ShopOrderFieldValue", "ShopOrderItem", "ShopOrder", "ShopSellerSchedule", "ShopSellerProduct", "ShopSeller", "ShopPromotionProduct", "ShopPromotion", "ShopProductField", "ShopProductImage", "ShopProductVariant", "ShopProduct", "ShopCategory", "ShopSettings", "ShopJob" CASCADE;

ALTER TABLE "TelegramCallbackToken" DROP COLUMN IF EXISTS "shopOrderId";

DROP TYPE IF EXISTS "ShopProductType", "ShopStockMode", "ShopProductFieldType", "ShopDiscountType", "ShopOrderStatus", "ShopOrderActorType", "ShopOrderMessageVisibility", "ShopPaymentStatus", "ShopRefundStatus", "ShopPayoutStatus", "ShopReviewStatus", "ShopDisputeStatus", "ShopNotificationChannel", "ShopNotificationStatus", "ShopSellerDistributionMode", "ShopJobStatus";

DELETE FROM "RolePermission" WHERE "permission" IN ('shop.support', 'shop.manage');
