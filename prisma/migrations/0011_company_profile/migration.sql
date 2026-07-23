-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "legalName" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoData" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNo" TEXT,
    "bankSwift" TEXT,
    "bankIfsc" TEXT,
    "bankBranch" TEXT,
    "signatureName" TEXT,
    "footerNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

