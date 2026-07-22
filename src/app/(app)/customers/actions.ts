"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Turns an empty/blank field into null before number coercion, so a blank box
// stays empty instead of becoming 0.
const optionalNumber = (max?: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(max ?? Number.MAX_SAFE_INTEGER).nullable().optional(),
  );

const CustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  contactPerson: z.string().trim().optional(),
  email: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().email("Please enter a valid email address").optional(),
  ),
  phone: z.string().trim().optional(),
  altPhone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  country: z.string().trim().optional(),
  shippingAddress: z.string().trim().optional(),
  destinationPort: z.string().trim().optional(),
  incoterms: z.string().trim().optional(),
  gstin: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  currency: z.string().trim().min(1).default("INR"),
  paymentTerms: z.string().trim().optional(),
  creditLimit: optionalNumber(),
  defaultDiscount: optionalNumber(100),
  category: z.string().trim().optional(),
  salespersonId: z.string().trim().optional(),
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

// True when another customer already uses this name (case-insensitive),
// optionally excluding the customer being edited.
async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const match = await prisma.customer.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return !!match;
}

// Highest existing customer-code number (0 if none). Codes look like "CUST-007".
async function maxCodeNumber(): Promise<number> {
  const withCodes = await prisma.customer.findMany({
    where: { code: { startsWith: "CUST-" } },
    select: { code: true },
  });
  let max = 0;
  for (const { code } of withCodes) {
    const n = parseInt((code ?? "").slice(5), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max;
}

const codeFor = (n: number) => `CUST-${String(n).padStart(3, "0")}`;

// Next sequential customer code, e.g. "CUST-001". Derived from existing codes
// so it survives deletions.
async function nextCustomerCode(): Promise<string> {
  return codeFor((await maxCodeNumber()) + 1);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Bulk-create customers from parsed spreadsheet rows. Skips rows without a name
// and rows whose name already exists (case-insensitive), and drops invalid
// emails rather than failing the whole row.
export async function importCustomers(rows: Record<string, string>[]) {
  const textFields = [
    "contactPerson", "email", "phone", "altPhone", "address", "country",
    "shippingAddress", "destinationPort", "incoterms", "gstin", "taxId",
    "currency", "paymentTerms", "category",
  ];

  const existing = await prisma.customer.findMany({ select: { name: true } });
  const seen = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  let codeNum = await maxCodeNumber();

  let imported = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2; // +1 for header row, +1 for 1-based
    const name = (r.name ?? "").trim();
    if (!name) {
      skipped++;
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      skipped++;
      warnings.push(`Row ${line}: "${name}" already exists — skipped.`);
      continue;
    }
    seen.add(key);

    const data: Record<string, unknown> = { name };
    for (const f of textFields) {
      const v = (r[f] ?? "").trim();
      if (v) data[f] = v;
    }
    const cl = parseFloat((r.creditLimit ?? "").trim());
    if (!isNaN(cl)) data.creditLimit = cl;
    const dd = parseFloat((r.defaultDiscount ?? "").trim());
    if (!isNaN(dd)) data.defaultDiscount = Math.min(Math.max(dd, 0), 100);

    if (data.email && !EMAIL_RE.test(String(data.email))) {
      warnings.push(`Row ${line}: invalid email dropped.`);
      delete data.email;
    }
    if (!data.currency) data.currency = "INR";

    codeNum++;
    data.code = codeFor(codeNum);
    await prisma.customer.create({ data: data as never });
    imported++;
  }

  revalidatePath("/customers");
  return { imported, skipped, warnings };
}

export async function createCustomer(formData: FormData) {
  const result = parse(formData);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  if (await nameTaken(result.data.name)) {
    return { error: `A customer named "${result.data.name}" already exists.` };
  }
  const code = await nextCustomerCode();
  await prisma.customer.create({
    data: { ...clean(result.data), name: result.data.name, currency: result.data.currency, code } as never,
  });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(id: string, formData: FormData) {
  const result = parse(formData);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  if (await nameTaken(result.data.name, id)) {
    return { error: `Another customer named "${result.data.name}" already exists.` };
  }
  await prisma.customer.update({
    where: { id },
    data: { ...clean(result.data), name: result.data.name, currency: result.data.currency } as never,
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function setCustomerArchived(id: string, archived: boolean) {
  await prisma.customer.update({ where: { id }, data: { archived } });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
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
