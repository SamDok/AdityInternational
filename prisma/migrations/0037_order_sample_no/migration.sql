-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "sampleNo" INTEGER;


-- Backfill existing samples: give each its own running sampleNo (by creation
-- order) and move its `number` into the sample range (>= 1000001) so production
-- numbering stays gapless and never collides with a sample.
WITH s AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", "number") AS rn
  FROM "Order" WHERE "isSample" = true
)
UPDATE "Order" o SET "sampleNo" = s.rn, "number" = 1000000 + s.rn
FROM s WHERE o.id = s.id;
