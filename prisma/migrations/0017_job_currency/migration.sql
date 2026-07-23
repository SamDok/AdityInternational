-- Jobs carry the currency of the rates paid to the vendor (default INR).

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR';

