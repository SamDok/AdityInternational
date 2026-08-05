-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "blAwbNo" TEXT,
ADD COLUMN     "containerNo" TEXT,
ADD COLUMN     "discountPct" DOUBLE PRECISION,
ADD COLUMN     "eInvoiceIrn" TEXT,
ADD COLUMN     "ewayBillNo" TEXT,
ADD COLUMN     "freight" DOUBLE PRECISION,
ADD COLUMN     "fxRate" DOUBLE PRECISION,
ADD COLUMN     "insurance" DOUBLE PRECISION,
ADD COLUMN     "otherCharges" DOUBLE PRECISION,
ADD COLUMN     "portOfLoading" TEXT,
ADD COLUMN     "shippingBillNo" TEXT,
ADD COLUMN     "vessel" TEXT;

