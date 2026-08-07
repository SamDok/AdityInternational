"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const nullableStr = () => z.string().trim().optional().nullable();

const PaymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero"),
  currency: z.string().min(1).default("INR"),
  date: z.string().optional(),
  method: nullableStr(),
  reference: nullableStr(),
  note: nullableStr(),
  shipmentId: nullableStr(),
  jobId: nullableStr(),
  materialPoId: nullableStr(),
});

function toDate(v?: string) {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Record a receipt from a customer.
export async function recordPayment(customerId: string, input: unknown) {
  const me = await requireUser();
  const r = PaymentSchema.safeParse(input);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid payment" };
  const d = r.data;
  await prisma.payment.create({
    data: {
      customerId,
      shipmentId: d.shipmentId || null,
      amount: d.amount,
      currency: d.currency,
      date: toDate(d.date),
      method: d.method || null,
      reference: d.reference || null,
      note: d.note || null,
      createdByName: me.name || me.email,
    },
  });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/money");
  return { ok: true };
}

export async function deletePayment(id: string) {
  await requireUser();
  const p = await prisma.payment.findUnique({ where: { id }, select: { customerId: true } });
  await prisma.payment.delete({ where: { id } });
  if (p) revalidatePath(`/customers/${p.customerId}`);
  revalidatePath("/money");
}

// Record a payment made to a vendor.
export async function recordVendorPayment(vendorId: string, input: unknown) {
  const me = await requireUser();
  const r = PaymentSchema.safeParse(input);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid payment" };
  const d = r.data;
  await prisma.vendorPayment.create({
    data: {
      vendorId,
      jobId: d.jobId || null,
      materialPoId: d.materialPoId || null,
      amount: d.amount,
      currency: d.currency,
      date: toDate(d.date),
      method: d.method || null,
      reference: d.reference || null,
      note: d.note || null,
      createdByName: me.name || me.email,
    },
  });
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/money");
  return { ok: true };
}

export async function deleteVendorPayment(id: string) {
  await requireUser();
  const p = await prisma.vendorPayment.findUnique({ where: { id }, select: { vendorId: true } });
  await prisma.vendorPayment.delete({ where: { id } });
  if (p) revalidatePath(`/vendors/${p.vendorId}`);
  revalidatePath("/money");
}
