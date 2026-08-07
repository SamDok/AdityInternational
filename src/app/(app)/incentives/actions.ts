"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { financialYearLabel } from "@/lib/jobNumber";
import { getHsnRates, shipmentIncentive, inputGstPaid } from "@/lib/incentives";

function toDate(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Create PENDING Drawback + RoDTEP claims for export shipments that don't have
// them yet, snapshotting the current estimate. Idempotent — re-runs only add the
// missing ones. The shipping-bill number seeds the reference for reconciliation.
export async function generateShipmentClaims(): Promise<{ created: number } | { error: string }> {
  const me = await requireUser();
  const rates = await getHsnRates();
  const shipments = await prisma.shipment.findMany({
    where: { status: { not: "CANCELLED" }, isSample: false, currency: { not: "INR" } },
    select: {
      id: true, date: true, currency: true, fxRate: true, shippingBillNo: true,
      incentiveClaims: { select: { type: true } },
      items: { select: { quantity: true, rate: true, product: { select: { design: { select: { hsnCode: true } } } } } },
    },
  });
  let created = 0;
  for (const s of shipments) {
    const have = new Set(s.incentiveClaims.map((c) => c.type));
    const inc = shipmentIncentive(s.items.map((i) => ({ amount: i.quantity * i.rate, hsnCode: i.product.design?.hsnCode ?? null })), s.currency, s.fxRate, rates);
    const fyLabel = financialYearLabel(s.date);
    const base = { shipmentId: s.id, fyLabel, status: "PENDING", reference: s.shippingBillNo || null, createdByName: me.name || me.email };
    if (inc.drawbackInr > 0.5 && !have.has("DRAWBACK")) { await prisma.incentiveClaim.create({ data: { ...base, type: "DRAWBACK", amount: inc.drawbackInr } }); created++; }
    if (inc.rodtepInr > 0.5 && !have.has("RODTEP")) { await prisma.incentiveClaim.create({ data: { ...base, type: "RODTEP", amount: inc.rodtepInr } }); created++; }
  }
  revalidatePath("/incentives");
  revalidatePath("/reports");
  return { created };
}

// Create an ITC-refund claim for a period, defaulting the amount to the current
// input-GST pool (the owner adjusts to what they actually file in RFD-01).
export async function createItcClaim(): Promise<{ ok: true } | { error: string }> {
  const me = await requireUser();
  const items = await prisma.materialPOItem.findMany({ where: { po: { status: { not: "CANCELLED" } }, gstRate: { not: null } }, select: { qtyReceived: true, rate: true, gstRate: true } });
  const amount = inputGstPaid(items);
  if (amount <= 0.5) return { error: "No input GST captured on purchases yet." };
  await prisma.incentiveClaim.create({
    data: { type: "ITC_REFUND", fyLabel: financialYearLabel(new Date()), amount, status: "PENDING", createdByName: me.name || me.email },
  });
  revalidatePath("/incentives");
  revalidatePath("/reports");
  return { ok: true };
}

export async function fileClaim(id: string, input: { reference?: string | null; filedDate?: string | null }) {
  await requireUser();
  await prisma.incentiveClaim.update({ where: { id }, data: { status: "FILED", reference: input.reference || undefined, filedDate: toDate(input.filedDate) ?? new Date() } });
  revalidatePath("/incentives");
  revalidatePath("/reports");
  return { ok: true };
}

export async function receiveClaim(id: string, input: { receivedAmount?: number | null; receivedDate?: string | null; reference?: string | null }) {
  await requireUser();
  await prisma.incentiveClaim.update({
    where: { id },
    data: { status: "RECEIVED", receivedAmount: input.receivedAmount ?? undefined, receivedDate: toDate(input.receivedDate) ?? new Date(), reference: input.reference || undefined },
  });
  revalidatePath("/incentives");
  revalidatePath("/reports");
  return { ok: true };
}

export async function reopenClaim(id: string) {
  await requireUser();
  await prisma.incentiveClaim.update({ where: { id }, data: { status: "PENDING", filedDate: null, receivedDate: null, receivedAmount: null } });
  revalidatePath("/incentives");
  revalidatePath("/reports");
  return { ok: true };
}

export async function deleteClaim(id: string) {
  await requireUser();
  await prisma.incentiveClaim.delete({ where: { id } });
  revalidatePath("/incentives");
  revalidatePath("/reports");
  return { ok: true };
}

// ---------------------------------------------------- Bank statement (Kotak)

import { normalizeRef } from "@/lib/incentives";

// Ingest credit lines parsed from the bank statement. dedupeKey (date|amount|
// narration|ref) means re-importing an overlapping statement is safe.
export async function importBankCredits(
  rows: { date: string; amount: number; narration?: string | null; reference?: string | null }[],
): Promise<{ added: number; skipped: number } | { error: string }> {
  await requireUser();
  let added = 0;
  let skipped = 0;
  for (const r of rows) {
    const d = new Date(r.date);
    if (isNaN(d.getTime()) || !(r.amount > 0)) { skipped++; continue; }
    const dedupeKey = `${d.toISOString().slice(0, 10)}|${Math.round(r.amount * 100)}|${normalizeRef(r.narration ?? "").slice(0, 40)}|${normalizeRef(r.reference ?? "")}`;
    try {
      await prisma.bankCredit.create({ data: { date: d, amount: r.amount, narration: r.narration || null, reference: r.reference || null, dedupeKey } });
      added++;
    } catch {
      skipped++; // unique dedupeKey → already imported
    }
  }
  revalidatePath("/incentives/reconcile");
  return { added, skipped };
}

// Tie a bank credit to a claim and mark the claim received for the credited amount.
export async function reconcileCredit(creditId: string, claimId: string) {
  await requireUser();
  const credit = await prisma.bankCredit.findUnique({ where: { id: creditId } });
  if (!credit) return { error: "Credit not found." };
  await prisma.$transaction([
    prisma.bankCredit.update({ where: { id: creditId }, data: { reconciled: true, claimId } }),
    prisma.incentiveClaim.update({ where: { id: claimId }, data: { status: "RECEIVED", receivedAmount: credit.amount, receivedDate: credit.date } }),
  ]);
  revalidatePath("/incentives/reconcile");
  revalidatePath("/incentives");
  revalidatePath("/reports");
  return { ok: true };
}

export async function unlinkCredit(creditId: string) {
  await requireUser();
  await prisma.bankCredit.update({ where: { id: creditId }, data: { reconciled: false, claimId: null } });
  revalidatePath("/incentives/reconcile");
  return { ok: true };
}

export async function deleteBankCredit(creditId: string) {
  await requireUser();
  await prisma.bankCredit.delete({ where: { id: creditId } });
  revalidatePath("/incentives/reconcile");
  return { ok: true };
}
