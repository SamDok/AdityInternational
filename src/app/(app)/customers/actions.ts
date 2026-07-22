"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const CustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  company: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  country: z.string().trim().optional(),
  gstin: z.string().trim().optional(),
  currency: z.string().trim().min(1).default("INR"),
  paymentTerms: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const result = CustomerSchema.safeParse(raw);
  return result;
}

function clean<T extends Record<string, unknown>>(data: T) {
  // Turn empty strings into null so the DB stores nothing rather than "".
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v === "" || v === undefined ? null : v;
  }
  return out;
}

export async function createCustomer(formData: FormData) {
  const result = parse(formData);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  await prisma.customer.create({
    data: { ...clean(result.data), name: result.data.name, currency: result.data.currency } as never,
  });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(id: string, formData: FormData) {
  const result = parse(formData);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  await prisma.customer.update({
    where: { id },
    data: { ...clean(result.data), name: result.data.name, currency: result.data.currency } as never,
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  const orderCount = await prisma.order.count({ where: { customerId: id } });
  if (orderCount > 0) {
    return { error: "This customer has orders and can't be deleted." };
  }
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  redirect("/customers");
}
