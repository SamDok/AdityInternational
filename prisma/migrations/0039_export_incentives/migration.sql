-- AlterTable
ALTER TABLE "MaterialPOItem" ADD COLUMN     "gstRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "HsnIncentiveRate" (
    "id" TEXT NOT NULL,
    "hsnCode" TEXT NOT NULL,
    "drawbackPct" DOUBLE PRECISION,
    "drawbackCap" DOUBLE PRECISION,
    "rodtepPct" DOUBLE PRECISION,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HsnIncentiveRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HsnIncentiveRate_hsnCode_key" ON "HsnIncentiveRate"("hsnCode");

