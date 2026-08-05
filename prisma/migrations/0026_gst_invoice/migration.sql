-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN     "country" TEXT,
ADD COLUMN     "defaultGstRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Design" ADD COLUMN     "gstRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "destinationCountry" TEXT;

