-- CreateTable
CREATE TABLE "IncentiveClaim" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shipmentId" TEXT,
    "fyLabel" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "filedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "receivedAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentiveClaim_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IncentiveClaim" ADD CONSTRAINT "IncentiveClaim_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

