-- Phase B: item-wise fulfillment. Per-line due dates, per-line shipped tracking,
-- and a Stage (Draft/Confirmed/Cancelled) + derived shipping status. Stock now
-- moves per shipment, so the order-level stockDeducted flag is retired.

-- 1) Per-line due date (additive).
ALTER TABLE "OrderItem" ADD COLUMN "dueDate" TIMESTAMP(3);

-- 2) Backfill: orders whose stock was already taken out (old all-or-nothing model)
--    are treated as fully shipped, so their derived status stays correct WITHOUT
--    creating any new stock movement (the stock already left).
UPDATE "OrderItem" oi
SET "shippedQty" = oi."quantity"
FROM "Order" o
WHERE oi."orderId" = o."id" AND o."stockDeducted" = true;

-- 3) Collapse the old 6 statuses into the new 3 stages. Shipped/Completed/In
--    production all map to Confirmed; shipping state is now derived from shippedQty.
UPDATE "Order" SET "status" = 'CONFIRMED'
WHERE "status" IN ('IN_PRODUCTION', 'SHIPPED', 'COMPLETED');

-- 4) Retire the obsolete flag (internal bookkeeping only).
ALTER TABLE "Order" DROP COLUMN "stockDeducted";
