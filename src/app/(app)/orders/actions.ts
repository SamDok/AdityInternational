"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ORDER_STAGES } from "@/lib/format";
import { applyMovements, type StockMove } from "@/lib/stock";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { planProcurement } from "./procurement";

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
  await requireUser();
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
// shipping is tracked per line via recordShipment.
export async function updateOrderStage(id: string, stage: string) {
  await requireUser();
  if (!ORDER_STAGES.includes(stage as never)) return { error: "Unknown stage" };
  await prisma.order.update({ where: { id }, data: { status: stage } });
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
}

// Record a shipment: add to each line's shippedQty and take that much out of
// stock, logged as ORDER_SHIP. Mirrors receiveJob for the inbound side.
export async function recordShipment(orderId: string, lines: { itemId: string; ship: number }[]) {
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
  const requests: { it: (typeof order.items)[number]; ship: number }[] = [];
  const wantByProduct = new Map<string, number>();
  for (const l of lines) {
    const it = byId.get(l.itemId);
    if (!it || !(l.ship > 0)) continue;
    requests.push({ it, ship: l.ship });
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
  for (const { it, ship } of requests) {
    ops.push(prisma.orderItem.update({ where: { id: it.id }, data: { shippedQty: { increment: ship } } }));
    moves.push({ productId: it.productId, delta: -ship, reason: "ORDER_SHIP", orderId });
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

// Undo a line's shipment (correction): restore its shippedQty to 0 and add the
// stock back, logged as ORDER_UNSHIP.
export async function unshipLine(itemId: string) {
  await requireUser();
  const it = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { shippedQty: true, productId: true, orderId: true },
  });
  if (!it) return { error: "Line not found." };
  if (it.shippedQty > 0) {
    const userId = (await getCurrentUser())?.id ?? null;
    await applyMovements([{ productId: it.productId, delta: it.shippedQty, reason: "ORDER_UNSHIP", orderId: it.orderId, userId }]);
    await prisma.orderItem.update({ where: { id: itemId }, data: { shippedQty: 0 } });
  }
  revalidatePath(`/orders/${it.orderId}`);
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

  let number = await nextJobNumber();
  const createdIds: string[] = [];
  for (const g of plan.groups) {
    const job = await prisma.job.create({
      data: {
        number,
        vendorId: g.vendorId,
        kind: g.kind,
        status: "OPEN",
        currency: g.lines[0]?.currency ?? "INR",
        dueDate: g.jobDueDate ?? null,
        orderId,
        notes: `Auto-generated from order #${plan.orderNumber}`,
        items: {
          create: g.lines.map((l) => ({
            productId: l.productId,
            qtyOrdered: l.shortfall,
            rate: l.rate ?? null,
            unit: l.unit,
          })),
        },
      },
    });
    createdIds.push(job.id);
    number += 1;
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true, count: createdIds.length };
}

async function nextJobNumber(): Promise<number> {
  const last = await prisma.job.findFirst({ orderBy: { number: "desc" } });
  return last ? last.number + 1 : 1;
}

export async function deleteOrder(id: string) {
  await requireUser();
  const shipped = await prisma.orderItem.count({ where: { orderId: id, shippedQty: { gt: 0 } } });
  if (shipped > 0) {
    return { error: "This order has shipped items — un-ship them before deleting." };
  }
  await prisma.order.delete({ where: { id } }); // items cascade
  revalidatePath("/orders");
  revalidatePath("/");
  redirect("/orders");
}
