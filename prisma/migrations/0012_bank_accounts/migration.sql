-- Replace the single bank block on CompanyProfile with one BankAccount per currency.

-- AlterTable
ALTER TABLE "CompanyProfile" DROP COLUMN "bankAccountName",
DROP COLUMN "bankAccountNo",
DROP COLUMN "bankBranch",
DROP COLUMN "bankIfsc",
DROP COLUMN "bankName",
DROP COLUMN "bankSwift";

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNo" TEXT,
    "swift" TEXT,
    "ifsc" TEXT,
    "iban" TEXT,
    "branch" TEXT,
    "bankAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_currency_key" ON "BankAccount"("currency");

