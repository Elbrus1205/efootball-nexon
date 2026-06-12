DELETE FROM "RolePermission" WHERE "permission" = 'coins.manage';

DROP TABLE IF EXISTS "CoinServiceOrderMessage" CASCADE;
DROP TABLE IF EXISTS "CoinServiceExecutorAttempt" CASCADE;
DROP TABLE IF EXISTS "CoinServiceOrder" CASCADE;
DROP TABLE IF EXISTS "CoinServiceExecutor" CASCADE;
DROP TABLE IF EXISTS "CoinServiceProduct" CASCADE;
DROP TABLE IF EXISTS "CoinPaymentCard" CASCADE;
DROP TABLE IF EXISTS "CoinStoreSettings" CASCADE;
DROP TABLE IF EXISTS "CoinProduct" CASCADE;
DROP TABLE IF EXISTS "AffiliatePurchase" CASCADE;
DROP TABLE IF EXISTS "AffiliateReferral" CASCADE;
DROP TABLE IF EXISTS "AffiliateClick" CASCADE;
DROP TABLE IF EXISTS "AffiliatePartner" CASCADE;

DROP TYPE IF EXISTS "CoinServiceExecutorAttemptStatus";
DROP TYPE IF EXISTS "CoinServiceOrderStatus";
DROP TYPE IF EXISTS "CoinProductPlatform";
DROP TYPE IF EXISTS "CoinPaymentBank";
DROP TYPE IF EXISTS "AffiliatePurchaseSource";
