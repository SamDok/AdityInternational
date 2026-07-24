-- Received/shipped goods carry their real measures: actual metres (qtyReceived),
-- piece count (piecesReceived, drives completion) and weight; shipments record a
-- weight; movements log pieces + weight per event. Cumulative weight columns
-- default to 0 so per-receipt increments apply cleanly.

-- AlterTable
ALTER TABLE "JobItem" ADD COLUMN     "piecesReceived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weightReceived" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "shippedWeight" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "pieces" INTEGER,
ADD COLUMN     "weight" DOUBLE PRECISION;

