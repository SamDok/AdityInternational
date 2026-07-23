-- Remove the product default sale price: pricing is per-customer only.

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "salePrice";

