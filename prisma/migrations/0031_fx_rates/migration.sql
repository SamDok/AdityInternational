-- CreateTable
CREATE TABLE "FxRate" (
    "currency" TEXT NOT NULL,
    "perUnitInr" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("currency")
);

