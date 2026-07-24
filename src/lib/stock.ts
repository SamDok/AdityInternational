import { prisma } from "./prisma";

export type StockMove = {
  productId: string;
  delta: number; // + in / - out (metres)
  pieces?: number | null; // pieces moved in this event
  weight?: number | null; // weight (kg) moved in this event
  reason: "JOB_RECEIVE" | "ORDER_SHIP" | "ORDER_UNSHIP" | "MANUAL_ADJUST";
  orderId?: string | null;
  jobId?: string | null;
  userId?: string | null;
  note?: string | null;
};

// Apply a batch of stock changes and log each as a StockMovement, in one
// transaction. Uses raw increments (on-hand may go negative, e.g. oversell),
// so ship/unship stays symmetric.
export async function applyMovements(moves: StockMove[]) {
  const ops = [];
  for (const m of moves) {
    if (!m.delta) continue;
    ops.push(
      prisma.product.update({ where: { id: m.productId }, data: { stockQty: { increment: m.delta } } }),
      prisma.stockMovement.create({
        data: {
          productId: m.productId,
          delta: m.delta,
          pieces: m.pieces ?? null,
          weight: m.weight ?? null,
          reason: m.reason,
          orderId: m.orderId ?? null,
          jobId: m.jobId ?? null,
          userId: m.userId ?? null,
          note: m.note ?? null,
        },
      }),
    );
  }
  if (ops.length) await prisma.$transaction(ops);
}
