-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fyLabel" TEXT,
ADD COLUMN     "seq" INTEGER;


-- Backfill the financial-year tag from each order's date (Indian FY, Apr–Mar).
UPDATE "Order" SET "fyLabel" = (
  CASE WHEN EXTRACT(MONTH FROM "orderDate") >= 4
    THEN lpad((EXTRACT(YEAR FROM "orderDate")::int % 100)::text, 2, '0') || '-' || lpad(((EXTRACT(YEAR FROM "orderDate")::int + 1) % 100)::text, 2, '0')
    ELSE lpad(((EXTRACT(YEAR FROM "orderDate")::int - 1) % 100)::text, 2, '0') || '-' || lpad((EXTRACT(YEAR FROM "orderDate")::int % 100)::text, 2, '0')
  END
) WHERE "fyLabel" IS NULL;

-- Backfill the per-(isSample, financial year) sequence in creation order.
WITH s AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "isSample", "fyLabel" ORDER BY "createdAt", "number") AS rn
  FROM "Order"
)
UPDATE "Order" o SET "seq" = s.rn FROM s WHERE o.id = s.id AND o."seq" IS NULL;
