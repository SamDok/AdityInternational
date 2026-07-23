-- AlterTable (additive) — snapshot of customer details on the order, for the proforma PDF
ALTER TABLE "Order" ADD COLUMN "billToName" TEXT;
ALTER TABLE "Order" ADD COLUMN "billToAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "billToTaxId" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToName" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "destinationPort" TEXT;
ALTER TABLE "Order" ADD COLUMN "incoterms" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentTerms" TEXT;

-- AlterTable (additive) — pieces per line + item-wise shipped quantity
ALTER TABLE "OrderItem" ADD COLUMN "pieces" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "shippedQty" DOUBLE PRECISION NOT NULL DEFAULT 0;
