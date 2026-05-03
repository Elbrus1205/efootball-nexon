ALTER TABLE "CoinServiceOrder" ADD COLUMN "paymentReceiptFileName" TEXT;
ALTER TABLE "CoinServiceOrder" ADD COLUMN "paymentReceiptMimeType" TEXT;
ALTER TABLE "CoinServiceOrder" ADD COLUMN "paymentReceiptSize" INTEGER;
ALTER TABLE "CoinServiceOrder" ADD COLUMN "paymentReceiptData" BYTEA;
