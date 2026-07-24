-- Job/PO lines become piece-wise like order lines: pieces × perPieceQty.
-- qtyOrdered stays the computed total. Nullable so existing lines read as loose.

-- AlterTable
ALTER TABLE "JobItem" ADD COLUMN     "perPieceQty" DOUBLE PRECISION,
ADD COLUMN     "pieces" INTEGER;

