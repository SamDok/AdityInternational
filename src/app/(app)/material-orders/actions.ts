"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, isOwner, getCurrentUser } from "@/lib/auth";
import { applyMaterialMovements } from "@/lib/materials";
import { financialYearLabel } from "@/lib/jobNumber";

const ItemSchema = z.object({
  id: z.string().optional(),
  materialId: z.string().min(1),
  qtyOrdered: z.coerce.number().min(0),
  rate: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable().optional()),
  unit: z.string().min(1).default("mtr"),
  note: z.string().optional().nullable(),
});

const PoSchema = z.object({
  vendorId: z.string().min(1, "Choose a supplier"),
  currency: z.string().min(1).default("INR"),
  issueDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(ItemSchema).min(1, "Add at least one material line"),
});

export type MaterialPoInput = z.input<typeof PoSchema>;

function toDate(v?: string | null) {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

function itemData(it: z.infer<typeof ItemSchema>) {
  return { materialId: it.materialId, qtyOrdered: it.qtyOrdered, rate: it.rate ?? null, unit: it.unit, note: it.note || null };
}

async function allocateMaterialPoNumbers(issueDate: Date) {
  const fyLabel = financialYearLabel(issueDate);
  const [lastNum, lastSeq] = await Promise.all([
    prisma.materialPurchaseOrder.findFirst({ orderBy: { number: "desc" }, select: { number: true } }),
    prisma.materialPurchaseOrder.findFirst({ where: { fyLabel }, orderBy: { seq: "desc" }, select: { seq: true } }),
  ]);
  return { number: (lastNum?.number ?? 0) + 1, seq: (lastSeq?.seq ?? 0) + 1, fyLabel };
}

function poStatusFrom(items: { qtyOrdered: number; qtyReceived: number }[]): string {
  const allDone = items.length > 0 && items.every((i) => i.qtyReceived >= i.qtyOrdered);
  const anyReceived = items.some((i) => i.qtyReceived > 0);
  return allDone ? "RECEIVED" : anyReceived ? "PARTIAL" : "OPEN";
}

export async function createMaterialPo(input: MaterialPoInput) {
  await requireUser();
  const parsed = PoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid purchase order" };
  const d = parsed.data;
  const issueDate = toDate(d.issueDate) ?? new Date();
  const { number, seq, fyLabel } = await allocateMaterialPoNumbers(issueDate);
  const po = await prisma.materialPurchaseOrder.create({
    data: {
      number, seq, fyLabel,
      vendorId: d.vendorId,
      currency: d.currency,
      issueDate,
      dueDate: toDate(d.dueDate) ?? null,
      notes: d.notes || null,
      items: { create: d.items.map(itemData) },
    },
  });
  revalidatePath("/material-orders");
  redirect(`/material-orders/${po.id}`);
}

// Record what was received per line: qty into material stock (PURCHASE), plus
// refresh the material's last cost + supplier.
export async function receiveMaterialPo(poId: string, receipts: { itemId: string; qty: number }[]) {
  await requireUser();
  const po = await prisma.materialPurchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
  if (!po) return { error: "Purchase order not found." };
  if (po.status === "CANCELLED") return { error: "This purchase order is cancelled." };

  const ops = [];
  const moves = [];
  const materialUpdates: { id: string; rate: number | null }[] = [];
  for (const r of receipts) {
    const item = po.items.find((i) => i.id === r.itemId);
    if (!item) continue;
    const qty = r.qty > 0 ? r.qty : 0;
    if (qty <= 0) continue;
    ops.push(prisma.materialPOItem.update({ where: { id: item.id }, data: { qtyReceived: { increment: qty } } }));
    moves.push({ materialId: item.materialId, delta: qty, reason: "PURCHASE" as const, materialPoId: poId });
    materialUpdates.push({ id: item.materialId, rate: item.rate ?? null });
  }
  if (ops.length === 0) return { error: "Enter what you received." };
  await prisma.$transaction(ops);

  const userId = (await getCurrentUser())?.id ?? null;
  await applyMaterialMovements(moves.map((m) => ({ ...m, userId })));

  // Refresh each received material's last cost + default supplier.
  for (const u of materialUpdates) {
    await prisma.rawMaterial.update({
      where: { id: u.id },
      data: { supplierId: po.vendorId, ...(u.rate != null ? { costPrice: u.rate, currency: po.currency } : {}) },
    });
  }

  const items = await prisma.materialPOItem.findMany({ where: { poId }, select: { qtyOrdered: true, qtyReceived: true } });
  await prisma.materialPurchaseOrder.update({ where: { id: poId }, data: { status: poStatusFrom(items) } });

  revalidatePath(`/material-orders/${poId}`);
  revalidatePath("/material-orders");
  revalidatePath("/materials");
  return { ok: true };
}

export async function cancelMaterialPo(id: string) {
  await requireUser();
  await prisma.materialPurchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath(`/material-orders/${id}`);
  revalidatePath("/material-orders");
}

export async function deleteMaterialPo(id: string) {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can delete purchase orders." };
  const received = await prisma.materialPOItem.count({ where: { poId: id, qtyReceived: { gt: 0 } } });
  if (received > 0) return { error: "This PO has received stock. Cancel it instead of deleting." };
  await prisma.materialPurchaseOrder.delete({ where: { id } });
  revalidatePath("/material-orders");
  redirect("/material-orders");
}
