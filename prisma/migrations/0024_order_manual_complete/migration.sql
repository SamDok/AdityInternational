-- Manual 'mark complete' flag for orders (short-measured but all pieces shipped).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "manualComplete" BOOLEAN NOT NULL DEFAULT false;
