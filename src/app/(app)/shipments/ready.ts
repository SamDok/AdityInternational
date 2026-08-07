import { prisma } from "@/lib/prisma";
import { orderComplete, roundQty } from "@/lib/format";

// One shippable order line for the builder, with a suggested "ready" quantity
// (stock on hand, allocated greedily across lines that share a product).
export type ReadyLine = {
  orderItemId: string;
  orderId: string;
  orderNumber: number;
  isSample: boolean;
  sampleNo: number | null;
  seq: number | null;
  fyLabel: string | null;
  productName: string;
  designImage: string | null;
  unit: string;
  perPieceQty: number | null;
  ordered: number;
  shipped: number;
  remaining: number;
  stock: number;
  ready: number;
  rate: number;
};

// Every line across a customer's active (not-complete, not-cancelled) orders that
// still has something to ship AND stock available to send now.
export async function customerReadyLines(customerId: string): Promise<ReadyLine[]> {
  const orders = await prisma.order.findMany({
    where: { customerId, status: { not: "CANCELLED" } },
    orderBy: { number: "asc" },
    include: { items: { include: { product: { include: { design: { select: { id: true, image: { select: { designId: true } } } } } } } } },
  });
  const active = orders.filter((o) => !orderComplete({ manualComplete: o.manualComplete, items: o.items }));

  const pool = new Map<string, number>(); // remaining stock per product as we allocate
  const lines: ReadyLine[] = [];
  for (const o of active) {
    for (const it of o.items) {
      const remaining = it.quantity - it.shippedQty;
      if (remaining <= 1e-9) continue;
      if (!pool.has(it.productId)) pool.set(it.productId, it.product.stockQty || 0);
      const avail = pool.get(it.productId)!;
      const ready = Math.max(0, Math.min(remaining, avail));
      if (ready <= 1e-9) continue; // nothing in stock to send for this line right now
      pool.set(it.productId, avail - ready);
      lines.push({
        orderItemId: it.id, orderId: o.id, orderNumber: o.number,
        isSample: o.isSample, sampleNo: o.sampleNo, seq: o.seq, fyLabel: o.fyLabel,
        productName: it.product.name, designImage: it.product.design?.image ? `/designs/${it.product.design.id}/image` : null,
        unit: it.unit, perPieceQty: it.perPieceQty, ordered: roundQty(it.quantity), shipped: roundQty(it.shippedQty),
        remaining: roundQty(remaining), stock: roundQty(it.product.stockQty || 0), ready: roundQty(ready), rate: it.rate,
      });
    }
  }
  return lines;
}
