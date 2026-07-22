-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "code" TEXT;
ALTER TABLE "Customer" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");
