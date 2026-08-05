"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applyMovements, type StockMove } from "@/lib/stock";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { financialYearLabel } from "@/lib/jobNumber";

const nullableStr = () => z.string().optional().nullable();

const LineSchema = z.object({
  orderItemId: z.string().min(1),
  qty: z.coerce.number().min(0),
  pieces: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable().optional()),
  netWeight: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable().optional()),
  cartons: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable().optional()),
});

const ShipmentSchema = z.object({
  customerId: z.string().min(1, "Please choose a customer"),
  currency: z.string().min(1).default("INR"),
  date: z.string().optional(),
  billToName: nullableStr(),
  billToAddress: nullableStr(),
  billToTaxId: nullableStr(),
  shipToName: nullableStr(),
  shipToAddress: nullableStr(),
  destinationPort: nullableStr(),
  destinationCountry: nullableStr(),
  incoterms: nullableStr(),
  paymentTerms: nullableStr(),
  marksNumbers: nullableStr(),
  grossWeight: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable().optional()),
  notes: nullableStr(),
  lines: z.array(LineSchema).min(1, "Add at least one line to ship"),
});

export type ShipmentInput = z.input<typeof ShipmentSchema>;

function toDate(v?: string | null) {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

// Allocate a shipment's numbers: a global internal `number` plus the per-financial
// -year document `seq` (single INV/PL series) and its `fyLabel`.
async function allocateShipmentNumbers(date: Date) {
  const fyLabel = financialYearLabel(date);
  const [lastNum, lastSeq] = await Promise.all([
    prisma.shipment.findFirst({ orderBy: { number: "desc" }, select: { number: true } }),
    prisma.shipment.findFirst({ where: { fyLabel }, orderBy: { seq: "desc" }, select: { seq: true } }),
  ]);
  return { number: (lastNum?.number ?? 0) + 1, seq: (lastSeq?.seq ?? 0) + 1, fyLabel };
}

// Create a shipment: pull selected order lines (all for one customer), drop the
// shipped metres out of stock, bump each order line's shippedQty/shippedWeight,
// and record it for the invoice + packing list. Generalises recordShipment.
export async function createShipment(input: ShipmentInput) {
  const me = await requireUser();
  const parsed = ShipmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid shipment" };
  const d = parsed.data;

  const wanted = d.lines.filter((l) => l.qty > 0);
  if (wanted.length === 0) return { error: "Enter a quantity to ship on at least one line." };

  // Load the order lines being shipped, with their order + product.
  const items = await prisma.orderItem.findMany({
    where: { id: { in: wanted.map((l) => l.orderItemId) } },
    select: {
      id: true, productId: true, quantity: true, shippedQty: true, unit: true, rate: true, description: true,
      order: { select: { id: true, customerId: true, status: true, currency: true } },
      product: { select: { name: true, stockQty: true } },
    },
  });
  const byId = new Map(items.map((it) => [it.id, it]));

  // Validate ownership + build requests, tallying demand per product.
  const requests: { it: (typeof items)[number]; qty: number; pieces: number | null; netWeight: number; cartons: number | null }[] = [];
  const wantByProduct = new Map<string, number>();
  for (const l of wanted) {
    const it = byId.get(l.orderItemId);
    if (!it) return { error: "A selected line no longer exists — refresh and try again." };
    if (it.order.customerId !== d.customerId) return { error: "All lines in a shipment must belong to the same customer." };
    if (it.order.status === "CANCELLED") return { error: `Order for ${it.product.name} is cancelled.` };
    if (it.order.currency !== d.currency) return { error: "All clubbed orders must share the same currency." };
    requests.push({ it, qty: l.qty, pieces: l.pieces ?? null, netWeight: l.netWeight ?? 0, cartons: l.cartons ?? null });
    wantByProduct.set(it.productId, (wantByProduct.get(it.productId) ?? 0) + l.qty);
  }

  // Never ship more of a product than is physically in stock (aggregate across lines).
  for (const [productId, want] of wantByProduct) {
    const it = items.find((i) => i.productId === productId)!;
    if (want > it.product.stockQty + 1e-9) {
      return { error: `Only ${it.product.stockQty} ${it.unit} of ${it.product.name} in stock — receive more before shipping that much.` };
    }
  }

  const date = toDate(d.date) ?? new Date();
  const { number, seq, fyLabel } = await allocateShipmentNumbers(date);

  const shipment = await prisma.shipment.create({
    data: {
      number, seq, fyLabel, date,
      customerId: d.customerId,
      currency: d.currency,
      billToName: d.billToName || null,
      billToAddress: d.billToAddress || null,
      billToTaxId: d.billToTaxId || null,
      shipToName: d.shipToName || null,
      shipToAddress: d.shipToAddress || null,
      destinationPort: d.destinationPort || null,
      destinationCountry: d.destinationCountry || null,
      incoterms: d.incoterms || null,
      paymentTerms: d.paymentTerms || null,
      marksNumbers: d.marksNumbers || null,
      grossWeight: d.grossWeight ?? null,
      notes: d.notes || null,
      createdByName: me.name || me.email,
      items: {
        create: requests.map((r) => ({
          orderItemId: r.it.id,
          productId: r.it.productId,
          description: r.it.description || null,
          unit: r.it.unit,
          pieces: r.pieces,
          quantity: r.qty,
          netWeight: r.netWeight,
          cartons: r.cartons,
          rate: r.it.rate,
        })),
      },
    },
  });

  // Bump each order line's shipped totals, then drop stock (one ORDER_SHIP per line).
  const ops = requests.map((r) =>
    prisma.orderItem.update({
      where: { id: r.it.id },
      data: { shippedQty: { increment: r.qty }, shippedWeight: { increment: r.netWeight } },
    }),
  );
  await prisma.$transaction(ops);

  const userId = (await getCurrentUser())?.id ?? null;
  const moves: StockMove[] = requests.map((r) => ({
    productId: r.it.productId,
    delta: -r.qty,
    pieces: r.pieces ? -r.pieces : null,
    weight: r.netWeight ? -r.netWeight : null,
    reason: "ORDER_SHIP",
    orderId: r.it.order.id,
    shipmentId: shipment.id,
    userId,
  }));
  await applyMovements(moves);

  revalidatePath("/shipments");
  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/");
  redirect(`/shipments/${shipment.id}`);
}

// Refine the packing-list detail after creating the shipment.
export async function updatePackingDetails(
  id: string,
  input: { marksNumbers?: string | null; grossWeight?: number | null; notes?: string | null; cartons?: { itemId: string; cartons: number | null }[] },
) {
  await requireUser();
  await prisma.$transaction([
    prisma.shipment.update({
      where: { id },
      data: {
        marksNumbers: input.marksNumbers || null,
        grossWeight: input.grossWeight ?? null,
        notes: input.notes || null,
      },
    }),
    ...(input.cartons ?? []).map((c) =>
      prisma.shipmentItem.update({ where: { id: c.itemId }, data: { cartons: c.cartons ?? null } }),
    ),
  ]);
  revalidatePath(`/shipments/${id}`);
  return { ok: true };
}

// Cancel a shipment: put the metres/pieces/weight back into stock, reverse each
// order line's shipped totals, and mark it CANCELLED.
export async function cancelShipment(id: string) {
  await requireUser();
  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { items: true } });
  if (!shipment) return { error: "Shipment not found." };
  if (shipment.status === "CANCELLED") return { error: "This shipment is already cancelled." };

  const userId = (await getCurrentUser())?.id ?? null;
  const moves: StockMove[] = shipment.items.map((it) => ({
    productId: it.productId,
    delta: it.quantity,
    pieces: it.pieces ? it.pieces : null,
    weight: it.netWeight ? it.netWeight : null,
    reason: "ORDER_UNSHIP",
    orderId: null,
    shipmentId: shipment.id,
    userId,
  }));
  await applyMovements(moves);

  await prisma.$transaction([
    ...shipment.items.map((it) =>
      prisma.orderItem.update({
        where: { id: it.orderItemId },
        data: { shippedQty: { decrement: it.quantity }, shippedWeight: { decrement: it.netWeight } },
      }),
    ),
    prisma.shipment.update({ where: { id }, data: { status: "CANCELLED" } }),
  ]);

  revalidatePath(`/shipments/${id}`);
  revalidatePath("/shipments");
  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/");
}
