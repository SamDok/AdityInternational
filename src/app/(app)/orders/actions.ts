"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ORDER_STAGES } from "@/lib/format";
import { applyMovements, type StockMove } from "@/lib/stock";
import { getCurrentUser, requireUser, isOwner } from "@/lib/auth";
import { planProcurement } from "./procurement";
import { allocateJobNumbers } from "../jobs/actions";

// A line is `pieces` pieces of `perPieceQty` metres each. Total (priced)
// quantity = (pieces || 1) × perPieceQty; pieces blank means loose metres.
// `id` is present for lines that already exist (so edits update in place).
const ItemSchema = z
  .object({
    id: z.string().optional(),
    productId: z.string().min(1),
    description: z.string().optional().nullable(),
    pieces: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable().optional()),
    perPieceQty: z.coerce.number().min(0),
    dueDate: z.string().optional().nullable(),
    unit: z.string().min(1),
    rate: z.coerce.number().min(0),
  })
  .transform((it) => {
    const pieces = it.pieces && it.pieces > 0 ? it.pieces : null;
    const quantity = (pieces ?? 1) * it.perPieceQty;
    return { ...it, pieces, quantity };
  });

const nullableStr = () => z.string().optional().nullable();

const OrderSchema = z.object({
  customerId: z.string().min(1, "Please choose a customer"),
  currency: z.string().min(1).default("INR"),
  status: z.enum(ORDER_STAGES).default("DRAFT"),
  orderDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Snapshot of the customer's details (frozen on the order for the PDF).
  billToName: nullableStr(),
  billToAddress: nullableStr(),
  billToTaxId: nullableStr(),
  shipToName: nullableStr(),
  shipToAddress: nullableStr(),
  destinationPort: nullableStr(),
  incoterms: nullableStr(),
  paymentTerms: nullableStr(),
  items: z.array(ItemSchema).min(1, "Add at least one product line"),
});

export type OrderInput = z.input<typeof OrderSchema>;
type Item = z.infer<typeof ItemSchema>;

function toDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

// The frozen customer-detail snapshot columns, pulled from validated input.
function snapshotFields(d: z.infer<typeof OrderSchema>) {
  return {
    billToName: d.billToName || null,
    billToAddress: d.billToAddress || null,
    billToTaxId: d.billToTaxId || null,
    shipToName: d.shipToName || null,
    shipToAddress: d.shipToAddress || null,
    destinationPort: d.destinationPort || null,
    incoterms: d.incoterms || null,
    paymentTerms: d.paymentTerms || null,
  };
}

// Common OrderItem column data (no orderId) for create and update.
function itemData(it: Item) {
  return {
    productId: it.productId,
    description: it.description || null,
    quantity: it.quantity,
    pieces: it.pieces ?? null,
    perPieceQty: it.perPieceQty,
    dueDate: toDate(it.dueDate) ?? null,
    unit: it.unit,
    rate: it.rate,
  };
}

async function nextOrderNumber(): Promise<number> {
  const last = await prisma.order.findFirst({ orderBy: { number: "desc" } });
  return last ? last.number + 1 : 1001;
}

export async function createOrder(input: OrderInput) {
  const me = await requireUser();
  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const d = parsed.data;
  const number = await nextOrderNumber();

  // Stock never moves at create time — it leaves only when a shipment is recorded.
  const order = await prisma.order.create({
    data: {
      number,
      customerId: d.customerId,
      currency: d.currency,
      status: d.status,
      orderDate: toDate(d.orderDate) ?? new Date(),
      dueDate: toDate(d.dueDate) ?? null,
      notes: d.notes || null,
      createdByName: me.name || me.email,
      ...snapshotFields(d),
      items: { create: d.items.map(itemData) },
    },
  });

  revalidatePath("/orders");
  revalidatePath("/");
  redirect(`/orders/${order.id}`);
}

export async function updateOrder(id: string, input: OrderInput) {
  await requireUser();
  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const d = parsed.data;

  const current = await prisma.order.findUnique({
    where: { id },
    select: { items: { select: { id: true, productId: true, shippedQty: true } } },
  });
  if (!current) return { error: "Order not found." };

  const existingById = new Map(current.items.map((i) => [i.id, i]));
  const incomingIds = new Set(d.items.map((it) => it.id).filter(Boolean) as string[]);

  // A shipped line must survive edits: can't delete it, and its quantity can't
  // drop below what's already gone out.
  const toDelete = current.items.filter((i) => !incomingIds.has(i.id));
  if (toDelete.some((i) => i.shippedQty > 0)) {
    return { error: "A line that's already been shipped can't be removed. Un-ship it first." };
  }
  for (const it of d.items) {
    const ex = it.id ? existingById.get(it.id) : undefined;
    if (ex && it.quantity < ex.shippedQty) {
      return { error: `A line's quantity can't be less than what's already shipped (${ex.shippedQty}).` };
    }
    if (ex && ex.shippedQty > 0 && it.productId !== ex.productId) {
      return { error: "A line that's already been shipped can't have its product changed. Un-ship it first." };
    }
  }

  const newLines = d.items.filter((it) => !(it.id && existingById.has(it.id)));
  const ops = [];

  if (toDelete.length) {
    ops.push(prisma.orderItem.deleteMany({ where: { id: { in: toDelete.map((i) => i.id) } } }));
  }
  ops.push(
    prisma.order.update({
      where: { id },
      data: {
        customerId: d.customerId,
        currency: d.currency,
        status: d.status,
        orderDate: toDate(d.orderDate) ?? undefined,
        dueDate: toDate(d.dueDate) ?? null,
        notes: d.notes || null,
        ...snapshotFields(d),
      },
    }),
  );
  for (const it of d.items) {
    if (it.id && existingById.has(it.id)) {
      ops.push(prisma.orderItem.update({ where: { id: it.id }, data: itemData(it) }));
    }
  }
  if (newLines.length) {
    ops.push(prisma.orderItem.createMany({ data: newLines.map((it) => ({ orderId: id, ...itemData(it) })) }));
  }
  await prisma.$transaction(ops);

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
  redirect(`/orders/${id}`);
}

// Set the commercial stage (Draft / Confirmed / Cancelled). No stock effect —
// shipping is tracked per line via recordShipment. When cancelling, the caller
// may also ask to cancel the order's still-open jobs (so kaarigars/suppliers are
// told to stop). Fabric already received stays in stock.
export async function updateOrderStage(id: string, stage: string, opts?: { cancelJobs?: boolean }) {
  await requireUser();
  if (!ORDER_STAGES.includes(stage as never)) return { error: "Unknown stage" };
  await prisma.order.update({ where: { id }, data: { status: stage } });
  if (stage === "CANCELLED" && opts?.cancelJobs) {
    await prisma.job.updateMany({
      where: { orderId: id, status: { in: ["OPEN", "PARTIAL"] } },
      data: { status: "CANCELLED" },
    });
    revalidatePath("/jobs");
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
}

// How many of this order's jobs are still open (used to decide whether to prompt
// about cancelling them alongside the order).
export async function openJobCountForOrder(id: string): Promise<number> {
  await requireUser();
  return prisma.job.count({ where: { orderId: id, status: { in: ["OPEN", "PARTIAL"] } } });
}

// "Can't make this design" — drop a single line from the order and stop the
// un-received part of its job, leaving the rest of the order live. Refuses if the
// line already shipped, or if it's the order's only line (cancel the order instead).
export async function dropOrderLine(itemId: string) {
  await requireUser();
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { id: true, orderId: true, productId: true, shippedQty: true },
  });
  if (!item) return { error: "Line not found." };
  if (item.shippedQty > 0) return { error: "This line has already shipped — un-ship it first." };

  const lineCount = await prisma.orderItem.count({ where: { orderId: item.orderId } });
  if (lineCount <= 1) return { error: "This is the order's only design — cancel the whole order instead." };

  // Trim this product from the order's open jobs: drop un-received job lines, and
  // cancel any job left with nothing to make.
  const jobs = await prisma.job.findMany({
    where: { orderId: item.orderId, status: { in: ["OPEN", "PARTIAL"] } },
    select: { id: true, items: { select: { id: true, productId: true, qtyOrdered: true, qtyReceived: true } } },
  });
  for (const job of jobs) {
    const toRemove = job.items.filter((ji) => ji.productId === item.productId && ji.qtyReceived <= 0);
    if (toRemove.length === 0) continue;
    await prisma.jobItem.deleteMany({ where: { id: { in: toRemove.map((ji) => ji.id) } } });
    const remaining = job.items.filter((ji) => !toRemove.some((r) => r.id === ji.id));
    if (remaining.length === 0) {
      await prisma.job.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
    } else {
      const allDone = remaining.every((i) => i.qtyReceived >= i.qtyOrdered);
      const anyReceived = remaining.some((i) => i.qtyReceived > 0);
      await prisma.job.update({ where: { id: job.id }, data: { status: allDone ? "RECEIVED" : anyReceived ? "PARTIAL" : "OPEN" } });
    }
  }

  await prisma.orderItem.delete({ where: { id: itemId } });

  revalidatePath(`/orders/${item.orderId}`);
  revalidatePath("/orders");
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true };
}

// Manually close an order as complete (or reopen it). Used when all pieces are
// shipped but the measured metres fall a little short of the ordered total.
export async function setOrderComplete(id: string, complete: boolean) {
  await requireUser();
  await prisma.order.update({ where: { id }, data: { manualComplete: complete } });
  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
  revalidatePath("/");
}

// Record a shipment: add to each line's shippedQty and take that much out of
// stock, logged as ORDER_SHIP. Mirrors receiveJob for the inbound side.
export async function recordShipment(orderId: string, lines: { itemId: string; ship: number; weight?: number | null }[]) {
  await requireUser();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      items: { select: { id: true, productId: true, unit: true, product: { select: { stockQty: true, name: true } } } },
    },
  });
  if (!order) return { error: "Order not found." };
  if (order.status === "CANCELLED") return { error: "This order is cancelled." };

  const byId = new Map(order.items.map((i) => [i.id, i]));

  // Gather the valid requests and tally demand per product. You may ship MORE
  // than was ordered, but never more of a product than is physically in stock.
  const requests: { it: (typeof order.items)[number]; ship: number; weight: number | null }[] = [];
  const wantByProduct = new Map<string, number>();
  for (const l of lines) {
    const it = byId.get(l.itemId);
    if (!it || !(l.ship > 0)) continue;
    const weight = l.weight && l.weight > 0 ? l.weight : null;
    requests.push({ it, ship: l.ship, weight });
    wantByProduct.set(it.productId, (wantByProduct.get(it.productId) ?? 0) + l.ship);
  }
  if (requests.length === 0) return { error: "Enter a quantity to ship." };

  for (const [productId, want] of wantByProduct) {
    const it = order.items.find((i) => i.productId === productId)!;
    const stock = it.product.stockQty;
    if (want > stock + 1e-9) {
      return { error: `Only ${stock} ${it.unit} of ${it.product.name} in stock — receive more before shipping that much.` };
    }
  }

  const ops = [];
  const moves: StockMove[] = [];
  for (const { it, ship, weight } of requests) {
    ops.push(prisma.orderItem.update({
      where: { id: it.id },
      data: { shippedQty: { increment: ship }, ...(weight != null ? { shippedWeight: { increment: weight } } : {}) },
    }));
    moves.push({ productId: it.productId, delta: -ship, weight: weight != null ? -weight : null, reason: "ORDER_SHIP", orderId });
  }
  await prisma.$transaction(ops);

  const userId = (await getCurrentUser())?.id ?? null;
  await applyMovements(moves.map((m) => ({ ...m, userId })));

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true };
}

// Review-then-generate: create one job (kaarigar) / purchase order (supplier) per
// vendor for the order's shortfall. Recomputes the plan server-side so it can't be
// tampered with, and tops up only what isn't already covered by stock or existing
// jobs for this order.
export async function generateProcurement(orderId: string) {
  await requireUser();
  const ord = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!ord) return { error: "Order not found." };
  if (ord.status !== "CONFIRMED") return { error: "Confirm the order before generating jobs." };
  const plan = await planProcurement(orderId);
  if (!plan) return { error: "Order not found." };
  if (plan.groups.length === 0) {
    return { error: "Nothing to generate — every line is covered by stock or has no vendor assigned." };
  }

  const now = new Date();
  const createdIds: string[] = [];
  for (const g of plan.groups) {
    const { number, seq, fyLabel } = await allocateJobNumbers(g.kind, now);
    const job = await prisma.job.create({
      data: {
        number,
        seq,
        fyLabel,
        vendorId: g.vendorId,
        kind: g.kind,
        status: "OPEN",
        currency: g.lines[0]?.currency ?? "INR",
        issueDate: now,
        dueDate: g.jobDueDate ?? null,
        orderId,
        notes: `Auto-generated from order #${plan.orderNumber}`,
        items: {
          create: g.lines.map((l) => {
            // Keep the job piece-wise when the shortfall is a whole number of the
            // order line's pieces; otherwise fall back to a loose quantity.
            const per = l.perPieceQty && l.perPieceQty > 0 ? l.perPieceQty : null;
            const exact = per != null && Math.abs(l.shortfall / per - Math.round(l.shortfall / per)) < 1e-9;
            const pieces = exact ? Math.round(l.shortfall / per!) : null;
            return {
              productId: l.productId,
              pieces,
              perPieceQty: pieces ? per : l.shortfall, // loose → perPieceQty holds the total
              qtyOrdered: l.shortfall,
              rate: l.rate ?? null,
              unit: l.unit,
            };
          }),
        },
      },
    });
    createdIds.push(job.id);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true, count: createdIds.length };
}

// Reduce a line's shipped quantity by `amount` (a correction), adding that much
// stock back. Clamped to what's currently shipped.
export async function reduceShipment(itemId: string, amount: number) {
  await requireUser();
  const it = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { shippedQty: true, shippedWeight: true, productId: true, orderId: true },
  });
  if (!it) return { error: "Line not found." };
  const amt = Math.min(Math.max(0, amount), it.shippedQty);
  if (amt > 0) {
    const userId = (await getCurrentUser())?.id ?? null;
    // Unwind weight in proportion to the metres being un-shipped.
    const frac = it.shippedQty > 0 ? amt / it.shippedQty : 0;
    const wBack = it.shippedWeight != null ? it.shippedWeight * frac : null;
    await applyMovements([{ productId: it.productId, delta: amt, weight: wBack, reason: "ORDER_UNSHIP", orderId: it.orderId, userId }]);
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { shippedQty: { decrement: amt }, ...(wBack != null ? { shippedWeight: { decrement: wBack } } : {}) },
    });
  }
  revalidatePath(`/orders/${it.orderId}`);
  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteOrder(id: string) {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can delete orders." };
  const shipped = await prisma.orderItem.count({ where: { orderId: id, shippedQty: { gt: 0 } } });
  if (shipped > 0) {
    return { error: "This order has shipped items — un-ship them before deleting." };
  }
  await prisma.order.delete({ where: { id } }); // items cascade
  revalidatePath("/orders");
  revalidatePath("/");
  redirect("/orders");
}
