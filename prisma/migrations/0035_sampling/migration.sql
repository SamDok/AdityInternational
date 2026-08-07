-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sampleSourceId" TEXT,
ADD COLUMN     "sampleStatus" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sampleSourceId_fkey" FOREIGN KEY ("sampleSourceId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

