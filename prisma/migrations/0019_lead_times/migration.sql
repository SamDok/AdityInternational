-- Make/procure lead times (days), for due-date early warnings.

-- AlterTable
ALTER TABLE "Design" ADD COLUMN     "leadDays" INTEGER;

-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN     "leadDays" INTEGER;

