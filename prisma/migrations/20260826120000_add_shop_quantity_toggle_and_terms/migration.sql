ALTER TABLE "ShopProductVariant"
ADD COLUMN "quantityEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ShopSettings"
SET "termsVersion" = 'shop-2026-08-26-beks-konami'
WHERE "id" = 'default';
