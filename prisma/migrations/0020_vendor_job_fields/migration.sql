-- Enrich vendors (contact, GST, currency/terms, bank, lead) and job lines (due, note).

-- AlterTable
ALTER TABLE "JobItem" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNo" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankIfsc" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankSwift" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "leadDays" INTEGER,
ADD COLUMN     "paymentTerms" TEXT;

