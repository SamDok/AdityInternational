-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "Customer" ADD COLUMN "altPhone" TEXT;
ALTER TABLE "Customer" ADD COLUMN "shippingAddress" TEXT;
ALTER TABLE "Customer" ADD COLUMN "destinationPort" TEXT;
ALTER TABLE "Customer" ADD COLUMN "incoterms" TEXT;
ALTER TABLE "Customer" ADD COLUMN "taxId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "creditLimit" DOUBLE PRECISION;
ALTER TABLE "Customer" ADD COLUMN "defaultDiscount" DOUBLE PRECISION;
ALTER TABLE "Customer" ADD COLUMN "category" TEXT;
ALTER TABLE "Customer" ADD COLUMN "salespersonId" TEXT;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
