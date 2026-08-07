-- CreateTable
CREATE TABLE "BankCredit" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "narration" TEXT,
    "reference" TEXT,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "claimId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankCredit_dedupeKey_key" ON "BankCredit"("dedupeKey");

-- AddForeignKey
ALTER TABLE "BankCredit" ADD CONSTRAINT "BankCredit_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "IncentiveClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

