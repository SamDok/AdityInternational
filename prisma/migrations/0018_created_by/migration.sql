-- Record which teammate created an order / customer (name snapshot).

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "createdByName" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdByName" TEXT;

