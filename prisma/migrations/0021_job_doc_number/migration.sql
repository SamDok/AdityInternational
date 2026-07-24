-- Document numbering for jobs: per-(kind, financial year) sequence (seq) tagged
-- with the Indian financial year (fyLabel), shown as JW/25-26/001 or PO/25-26/001.
-- Nullable so jobs created before this scheme fall back to their internal number.

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "fyLabel" TEXT,
ADD COLUMN     "seq" INTEGER;

