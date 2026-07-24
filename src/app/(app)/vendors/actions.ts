"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, isOwner } from "@/lib/auth";

const VENDOR_KINDS = ["KAARIGAR", "SUPPLIER", "BOTH"] as const;

const VendorSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  kind: z.enum(VENDOR_KINDS).default("KAARIGAR"),
  phone: z.string().trim().optional(),
  email: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().email("Please enter a valid email address").optional(),
  ),
  address: z.string().trim().optional(),
  country: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function parse(formData: FormData) {
  return VendorSchema.safeParse(Object.fromEntries(formData.entries()));
}

// Next sequential vendor code, e.g. "VEND-001" (derived from existing codes).
async function nextVendorCode(): Promise<string> {
  const withCodes = await prisma.vendor.findMany({
    where: { code: { startsWith: "VEND-" } },
    select: { code: true },
  });
  let max = 0;
  for (const { code } of withCodes) {
    const n = parseInt((code ?? "").slice(5), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `VEND-${String(max + 1).padStart(3, "0")}`;
}

async function nameTaken(name: string, exceptId?: string) {
  const m = await prisma.vendor.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return !!m;
}

function clean(d: z.infer<typeof VendorSchema>) {
  return {
    name: d.name,
    kind: d.kind,
    phone: d.phone || null,
    email: d.email || null,
    address: d.address || null,
    country: d.country || null,
    notes: d.notes || null,
  };
}

export async function createVendor(formData: FormData) {
  await requireUser();
  const r = parse(formData);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input" };
  if (await nameTaken(r.data.name)) return { error: `A vendor named "${r.data.name}" already exists.` };
  const code = await nextVendorCode();
  await prisma.vendor.create({ data: { ...clean(r.data), code } });
  revalidatePath("/vendors");
  redirect("/vendors");
}

export async function updateVendor(id: string, formData: FormData) {
  await requireUser();
  const r = parse(formData);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input" };
  if (await nameTaken(r.data.name, id)) return { error: `Another vendor named "${r.data.name}" already exists.` };
  await prisma.vendor.update({ where: { id }, data: clean(r.data) });
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  redirect(`/vendors/${id}`);
}

export async function setVendorArchived(id: string, archived: boolean) {
  await requireUser();
  await prisma.vendor.update({ where: { id }, data: { archived } });
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
}

export async function deleteVendor(id: string) {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can delete vendors." };
  const [jobs, designs] = await Promise.all([
    prisma.job.count({ where: { vendorId: id } }),
    prisma.design.count({ where: { vendorId: id } }),
  ]);
  if (jobs > 0 || designs > 0) {
    return { error: "This vendor is used by designs or jobs. Archive it instead." };
  }
  await prisma.vendor.delete({ where: { id } });
  revalidatePath("/vendors");
  redirect("/vendors");
}
