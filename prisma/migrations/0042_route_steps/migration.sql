-- CreateTable
CREATE TABLE "RouteStep" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "designId" TEXT,
    "seq" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "vendorId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'mtr',
    "ratioFromPrev" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RouteStep_categoryId_idx" ON "RouteStep"("categoryId");

-- CreateIndex
CREATE INDEX "RouteStep_designId_idx" ON "RouteStep"("designId");

-- AddForeignKey
ALTER TABLE "RouteStep" ADD CONSTRAINT "RouteStep_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStep" ADD CONSTRAINT "RouteStep_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStep" ADD CONSTRAINT "RouteStep_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

