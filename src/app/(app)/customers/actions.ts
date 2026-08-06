"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isBareDialCode } from "@/lib/dialCodes";
import { requireUser, isOwner } from "@/lib/auth";

// A phone that is blank or only an auto-filled dial code becomes empty.
const phoneField = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  return s === "" || isBareDialCode(s) ? undefined : s;
}, z.string().optional());

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
  phone: phoneField,
  altPhone: phoneField,
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
  tags: z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    const s = String(v ?? "").trim();
    if (!s) return [];
    return Array.from(new Set(s.split(",").map((t) => t.trim()).filter(Boolean)));
  }, z.array(z.string())).optional(),
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

// Loose key for near-duplicate names: lowercase, drop punctuation/spaces, and a
// trailing plural "s" — so "Classic Textile" and "Classic Textiles" collide.
function loosen(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
}

// Soft, non-blocking checks: a near-duplicate name, or a tax number already on
// file. Returns a human warning (or null). The caller lets the user override.
async function softDuplicateWarning(
  data: { name: string; gstin?: unknown; taxId?: unknown },
  exceptId?: string,
): Promise<string | null> {
  const not = exceptId ? { id: { not: exceptId } } : {};
  const gstin = String(data.gstin ?? "").trim();
  const taxId = String(data.taxId ?? "").trim();
  if (gstin) {
    const m = await prisma.customer.findFirst({ where: { gstin: { equals: gstin, mode: "insensitive" }, ...not }, select: { name: true } });
    if (m) return `GST number ${gstin} is already used by "${m.name}".`;
  }
  if (taxId) {
    const m = await prisma.customer.findFirst({ where: { taxId: { equals: taxId, mode: "insensitive" }, ...not }, select: { name: true } });
    if (m) return `Tax ID ${taxId} is already used by "${m.name}".`;
  }
  const key = loosen(data.name);
  if (key) {
    const candidates = await prisma.customer.findMany({ where: not, select: { id: true, name: true } });
    const near = candidates.find((c) => loosen(c.name) === key && c.name.toLowerCase() !== data.name.toLowerCase());
    if (near) return `This looks a lot like "${near.name}". Add anyway?`;
  }
  return null;
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
  await requireUser();
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
    const tags = (r.tags ?? "").split(/[;|]/).map((t) => t.trim()).filter(Boolean);
    if (tags.length) data.tags = Array.from(new Set(tags));

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
  const me = await requireUser();
  const result = parse(formData);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  if (await nameTaken(result.data.name)) {
    return { error: `A customer named "${result.data.name}" already exists.` };
  }
  // Soft warning the user can override by re-submitting with confirmDup=1.
  if (formData.get("confirmDup") !== "1") {
    const warning = await softDuplicateWarning(result.data);
    if (warning) return { warning };
  }
  const code = await nextCustomerCode();
  await prisma.customer.create({
    data: { ...clean(result.data), name: result.data.name, currency: result.data.currency, code, createdByName: me.name || me.email } as never,
  });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(id: string, formData: FormData) {
  const me = await requireUser();
  const result = parse(formData);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  if (await nameTaken(result.data.name, id)) {
    return { error: `Another customer named "${result.data.name}" already exists.` };
  }
  if (formData.get("confirmDup") !== "1") {
    const warning = await softDuplicateWarning(result.data, id);
    if (warning) return { warning };
  }
  await prisma.customer.update({
    where: { id },
    data: { ...clean(result.data), name: result.data.name, currency: result.data.currency, updatedByName: me.name || me.email } as never,
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function setCustomerArchived(id: string, archived: boolean) {
  await requireUser();
  await prisma.customer.update({ where: { id }, data: { archived } });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can delete customers." };
  const orderCount = await prisma.order.count({ where: { customerId: id } });
  if (orderCount > 0) {
    return { error: "This customer has orders and can't be deleted." };
  }
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  redirect("/customers");
}

// ----------------------------------------------------- Per-customer price list

const PriceSchema = z.object({
  productId: z.string().trim().min(1, "Please choose a product"),
  price: z.coerce.number().min(0),
  currency: z.string().trim().min(1).default("INR"),
});

// Set (or update) this customer's price for a width-variant. Upserts on the
// unique (customerId, productId), so re-setting a variant edits its price.
export async function setCustomerPrice(customerId: string, formData: FormData) {
  await requireUser();
  const r = PriceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input" };
  const { productId, price, currency } = r.data;
  await prisma.customerPrice.upsert({
    where: { customerId_productId: { customerId, productId } },
    create: { customerId, productId, price, currency },
    update: { price, currency },
  });
  revalidatePath(`/customers/${customerId}/prices`);
  return { ok: true };
}

export async function removeCustomerPrice(id: string) {
  await requireUser();
  const p = await prisma.customerPrice.delete({ where: { id }, select: { customerId: true } });
  revalidatePath(`/customers/${p.customerId}/prices`);
}

// Save a customer's regular price for a variant, called from the order form's
// opt-in "Save as regular price". Kept separate from a one-off order rate so a
// circumstantial price never overwrites the regular price unless asked.
// Whole-directory CSV export (one row per customer). Mirrors the import headers.
export async function exportCustomersCsv(): Promise<string> {
  await requireUser();
  const rows = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const header = [
    "code", "name", "company", "contactPerson", "email", "phone", "altPhone", "address",
    "country", "shippingAddress", "destinationPort", "incoterms", "gstin", "taxId",
    "currency", "paymentTerms", "creditLimit", "defaultDiscount", "category", "tags", "notes",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const c of rows) {
    lines.push([
      c.code, c.name, c.company, c.contactPerson, c.email, c.phone, c.altPhone, c.address,
      c.country, c.shippingAddress, c.destinationPort, c.incoterms, c.gstin, c.taxId,
      c.currency, c.paymentTerms, c.creditLimit, c.defaultDiscount, c.category, (c.tags ?? []).join("; "), c.notes,
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

export async function saveCustomerRegularPrice(
  customerId: string,
  productId: string,
  price: number,
  currency: string,
) {
  await requireUser();
  if (!customerId || !productId || !(price >= 0)) return { error: "Invalid price." };
  await prisma.customerPrice.upsert({
    where: { customerId_productId: { customerId, productId } },
    create: { customerId, productId, price, currency: currency || "INR" },
    update: { price, currency: currency || "INR" },
  });
  revalidatePath(`/customers/${customerId}/prices`);
  return { ok: true };
}
