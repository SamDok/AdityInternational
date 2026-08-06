"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, isOwner, getCurrentUser } from "@/lib/auth";
import { applyMaterialMovements, nextMaterialCode } from "@/lib/materials";

const KINDS = ["BASE_FABRIC", "EMBELLISHMENT", "THREAD", "OTHER"] as const;
const num = () => z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable().optional());

const MaterialSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  kind: z.enum(KINDS).default("BASE_FABRIC"),
  unit: z.string().trim().min(1).default("mtr"),
  costPrice: num(),
  currency: z.string().trim().min(1).default("INR"),
  reorderLevel: num(),
  hsnCode: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function parse(formData: FormData) {
  return MaterialSchema.safeParse(Object.fromEntries(formData.entries()));
}

function clean(d: z.infer<typeof MaterialSchema>) {
  return {
    name: d.name,
    kind: d.kind,
    unit: d.unit || "mtr",
    costPrice: d.costPrice ?? null,
    currency: d.currency || "INR",
    reorderLevel: d.reorderLevel ?? null,
    hsnCode: d.hsnCode || null,
    supplierId: d.supplierId || null,
    notes: d.notes || null,
  };
}

async function nameTaken(name: string, exceptId?: string) {
  const m = await prisma.rawMaterial.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return !!m;
}

export async function createMaterial(formData: FormData) {
  await requireUser();
  const r = parse(formData);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input" };
  if (await nameTaken(r.data.name)) return { error: `A material named "${r.data.name}" already exists.` };
  const code = await nextMaterialCode();
  await prisma.rawMaterial.create({ data: { ...clean(r.data), code } });
  revalidatePath("/materials");
  redirect("/materials");
}

export async function updateMaterial(id: string, formData: FormData) {
  await requireUser();
  const r = parse(formData);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input" };
  if (await nameTaken(r.data.name, id)) return { error: `Another material named "${r.data.name}" already exists.` };
  await prisma.rawMaterial.update({ where: { id }, data: clean(r.data) });
  revalidatePath("/materials");
  revalidatePath(`/materials/${id}`);
  redirect(`/materials/${id}`);
}

// Manual stock correction (stock take, spoilage, opening balance).
export async function adjustMaterialStock(id: string, delta: number, note?: string) {
  await requireUser();
  if (!delta || !Number.isFinite(delta)) return { error: "Enter how much to add or remove." };
  const userId = (await getCurrentUser())?.id ?? null;
  await applyMaterialMovements([{ materialId: id, delta, reason: "MANUAL_ADJUST", userId, note: note || null }]);
  revalidatePath("/materials");
  revalidatePath(`/materials/${id}`);
  return { ok: true };
}

export async function setMaterialArchived(id: string, archived: boolean) {
  await requireUser();
  await prisma.rawMaterial.update({ where: { id }, data: { archived } });
  revalidatePath("/materials");
  revalidatePath(`/materials/${id}`);
}

export async function deleteMaterial(id: string) {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can delete materials." };
  const [issues, poItems] = await Promise.all([
    prisma.jobMaterial.count({ where: { materialId: id } }),
    prisma.materialPOItem.count({ where: { materialId: id } }),
  ]);
  if (issues > 0 || poItems > 0) return { error: "This material has been used on jobs or POs. Archive it instead." };
  await prisma.$transaction([
    prisma.rawMaterialMovement.deleteMany({ where: { materialId: id } }),
    prisma.categoryMaterial.deleteMany({ where: { materialId: id } }),
    prisma.designMaterial.deleteMany({ where: { materialId: id } }),
    prisma.rawMaterial.delete({ where: { id } }),
  ]);
  revalidatePath("/materials");
  redirect("/materials");
}
