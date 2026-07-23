"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/format";
import { applyMovements, type StockMove } from "@/lib/stock";
import { getCurrentUser } from "@/lib/auth";

// Stock leaves when an order is dispatched; Completed follows Shipped.
const SHIPPED_SET = ["SHIPPED", "COMPLETED"];
const isShipped = (status: string) => SHIPPED_SET.includes(status);

// Build stock moves for an order's items. sign -1 = ship out, +1 = restore.
function orderMoves(
  orderId: string,
  items: { productId: string; quantity: number }[],
  sign: 1 | -1,
  userId: string | null,
): StockMove[] {
  return items.map((it) => ({
    productId: it.productId,
    delta: sign * it.quantity,
    reason: sign === -1 ? "ORDER_SHIP" : "ORDER_UNSHIP",
    orderId,
    userId,
  }));
}

// A line is `pieces` pieces of `perPieceQty` metres each. Total (priced)
// quantity = (pieces || 1) × perPieceQty; pieces blank means loose metres.
const ItemSchema = z
  .object({
    productId: z.string().min(1),
    description: z.string().optional().nullable(),
    pieces: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable().optional()),
    perPieceQty: z.coerce.number().min(0),
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
  status: z.enum(ORDER_STATUSES).default("DRAFT"),
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

// Build the OrderItem create payload from validated line input.
function itemCreate(items: z.infer<typeof ItemSchema>[]) {
  return items.map((it) => ({
    productId: it.productId,
    description: it.description || null,
    quantity: it.quantity,
    pieces: it.pieces ?? null,
    perPieceQty: it.perPieceQty,
    unit: it.unit,
    rate: it.rate,
  }));
}

async function nextOrderNumber(): Promise<number> {
  const last = await prisma.order.findFirst({ orderBy: { number: "desc" } });
  return last ? last.number + 1 : 1001;
}

export async function createOrder(input: OrderInput) {
  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const d = parsed.data;
  const number = await nextOrderNumber();

  const shipped = isShipped(d.status);
  const order = await prisma.order.create({
    data: {
      number,
      customerId: d.customerId,
      currency: d.currency,
      status: d.status,
      orderDate: toDate(d.orderDate) ?? new Date(),
      dueDate: toDate(d.dueDate) ?? null,
      notes: d.notes || null,
      stockDeducted: shipped,
      ...snapshotFields(d),
      items: { create: itemCreate(d.items) },
    },
  });

  // Rare: an order created already Shipped takes stock out immediately.
  if (shipped) {
    const userId = (await getCurrentUser())?.id ?? null;
    await applyMovements(orderMoves(order.id, d.items, -1, userId));
  }

  revalidatePath("/orders");
  revalidatePath("/");
  redirect(`/orders/${order.id}`);
}

export async function updateOrder(id: string, input: OrderInput) {
  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const d = parsed.data;

  const current = await prisma.order.findUnique({
    where: { id },
    select: { stockDeducted: true, items: { select: { productId: true, quantity: true } } },
  });
  if (!current) return { error: "Order not found." };
  const userId = (await getCurrentUser())?.id ?? null;
  const newShipped = isShipped(d.status);

  // If stock was already out for the OLD items, put it back before we replace
  // them; we re-deduct the NEW items below if still shipped.
  if (current.stockDeducted) {
    await applyMovements(orderMoves(id, current.items, 1, userId));
  }

  // Replace line items wholesale (simplest, reliable for a small order).
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: id } }),
    prisma.order.update({
      where: { id },
      data: {
        customerId: d.customerId,
        currency: d.currency,
        status: d.status,
        orderDate: toDate(d.orderDate) ?? undefined,
        dueDate: toDate(d.dueDate) ?? null,
        notes: d.notes || null,
        stockDeducted: newShipped,
        ...snapshotFields(d),
        items: { create: itemCreate(d.items) },
      },
    }),
  ]);

  if (newShipped) {
    await applyMovements(orderMoves(id, d.items.map((it) => ({ productId: it.productId, quantity: it.quantity })), -1, userId));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
  revalidatePath("/products");
  redirect(`/orders/${id}`);
}

export async function updateOrderStatus(id: string, status: string) {
  if (!ORDER_STATUSES.includes(status as never)) {
    return { error: "Unknown status" };
  }
  const order = await prisma.order.findUnique({
    where: { id },
    select: { stockDeducted: true, items: { select: { productId: true, quantity: true } } },
  });
  if (!order) return { error: "Order not found." };

  const newShipped = isShipped(status);
  let stockDeducted = order.stockDeducted;

  if (newShipped && !order.stockDeducted) {
    const userId = (await getCurrentUser())?.id ?? null;
    await applyMovements(orderMoves(id, order.items, -1, userId));
    stockDeducted = true;
  } else if (!newShipped && order.stockDeducted) {
    const userId = (await getCurrentUser())?.id ?? null;
    await applyMovements(orderMoves(id, order.items, 1, userId));
    stockDeducted = false;
  }

  await prisma.order.update({ where: { id }, data: { status, stockDeducted } });
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
  revalidatePath("/products");
}

export async function deleteOrder(id: string) {
  await prisma.order.delete({ where: { id } }); // items cascade
  revalidatePath("/orders");
  revalidatePath("/");
  redirect("/orders");
}
