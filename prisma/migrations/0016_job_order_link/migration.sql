-- Link an auto-generated job/purchase order back to the sales order it came from.

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "orderId" TEXT;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

