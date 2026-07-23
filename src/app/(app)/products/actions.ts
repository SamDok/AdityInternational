"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const str = () => z.string().trim().optional();
const optionalNumber = () =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).nullable().optional(),
  );

function issue(result: { success: false; error: z.ZodError }) {
  return { error: result.error.issues[0]?.message ?? "Invalid input" };
}

// ---------------------------------------------------------------- Categories

const CategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  hsnCode: str(),
  sortOrder: z.coerce.number().int().default(0),
});

export async function createCategory(formData: FormData) {
  const r = CategorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return issue(r);
  const exists = await prisma.productCategory.findFirst({
    where: { name: { equals: r.data.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists) return { error: `A type named "${r.data.name}" already exists.` };
  await prisma.productCategory.create({
    data: { name: r.data.name, hsnCode: r.data.hsnCode || null, sortOrder: r.data.sortOrder },
  });
  revalidatePath("/products");
  revalidatePath("/products/manage-types");
  return { ok: true };
}

export async function updateCategory(id: string, formData: FormData) {
  const r = CategorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return issue(r);
  const clash = await prisma.productCategory.findFirst({
    where: { name: { equals: r.data.name, mode: "insensitive" }, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { error: `Another type named "${r.data.name}" already exists.` };
  await prisma.productCategory.update({
    where: { id },
    data: { name: r.data.name, hsnCode: r.data.hsnCode || null, sortOrder: r.data.sortOrder },
  });
  revalidatePath("/products");
  revalidatePath("/products/manage-types");
  redirect("/products/manage-types");
}

export async function setCategoryArchived(id: string, archived: boolean) {
  await prisma.productCategory.update({ where: { id }, data: { archived } });
  revalidatePath("/products");
  revalidatePath("/products/manage-types");
}

// ------------------------------------------------------------------- Designs

const DesignSchema = z.object({
  categoryId: z.string().trim().min(1, "Please choose a product type"),
  code: z.string().trim().min(1, "Design code is required"),
  name: str(),
  composition: str(),
  hsnCode: str(),
  description: str(),
});

async function designCodeTaken(code: string, exceptId?: string) {
  const m = await prisma.design.findFirst({
    where: { code: { equals: code, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return !!m;
}

export async function createDesign(formData: FormData) {
  const r = DesignSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return issue(r);
  const d = r.data;
  if (await designCodeTaken(d.code)) return { error: `Design code "${d.code}" already exists.` };

  // Default the HSN from the category when not given.
  let hsn = d.hsnCode || null;
  if (!hsn) {
    const cat = await prisma.productCategory.findUnique({ where: { id: d.categoryId }, select: { hsnCode: true } });
    hsn = cat?.hsnCode ?? null;
  }
  const design = await prisma.design.create({
    data: {
      categoryId: d.categoryId,
      code: d.code,
      name: d.name || null,
      composition: d.composition || null,
      hsnCode: hsn,
      description: d.description || null,
    },
  });
  revalidatePath("/products");
  redirect(`/products/design/${design.id}`);
}

export async function updateDesign(id: string, formData: FormData) {
  const r = DesignSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return issue(r);
  const d = r.data;
  if (await designCodeTaken(d.code, id)) return { error: `Design code "${d.code}" already exists.` };
  await prisma.design.update({
    where: { id },
    data: {
      categoryId: d.categoryId,
      code: d.code,
      name: d.name || null,
      composition: d.composition || null,
      hsnCode: d.hsnCode || null,
      description: d.description || null,
    },
  });
  revalidatePath("/products");
  revalidatePath(`/products/design/${id}`);
  redirect(`/products/design/${id}`);
}

export async function setDesignArchived(id: string, archived: boolean) {
  await prisma.design.update({ where: { id }, data: { archived } });
  revalidatePath("/products");
  revalidatePath(`/products/design/${id}`);
}

export async function deleteDesign(id: string) {
  const variants = await prisma.product.count({ where: { designId: id } });
  if (variants > 0) return { error: "Remove this design's widths before deleting it." };
  await prisma.design.delete({ where: { id } });
  revalidatePath("/products");
  redirect("/products");
}

// ------------------------------------------------------- Width-variants (Product)

const VariantSchema = z.object({
  width: z.string().trim().min(1, "Width is required"),
  colour: str(),
  gsm: optionalNumber(),
  costPrice: optionalNumber(),
  salePrice: z.coerce.number().min(0).default(0),
  currency: z.string().trim().min(1).default("INR"),
  stockQty: z.coerce.number().default(0),
  unit: z.string().trim().min(1).default("mtr"),
  sku: str(),
});

// Human-readable name for a variant, used on order lines.
function variantName(code: string, width: string, colour?: string | null) {
  return `${code} · ${width}${colour ? ` · ${colour}` : ""}`;
}

export async function createVariant(designId: string, formData: FormData) {
  const r = VariantSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return issue(r);
  const design = await prisma.design.findUnique({ where: { id: designId }, select: { code: true } });
  if (!design) return { error: "Design not found." };
  const d = r.data;
  await prisma.product.create({
    data: {
      designId,
      name: variantName(design.code, d.width, d.colour),
      width: d.width,
      colour: d.colour || null,
      gsm: d.gsm ?? null,
      costPrice: d.costPrice ?? null,
      salePrice: d.salePrice,
      currency: d.currency,
      stockQty: d.stockQty,
      unit: d.unit,
      sku: d.sku || null,
    },
  });
  revalidatePath("/products");
  revalidatePath(`/products/design/${designId}`);
  redirect(`/products/design/${designId}`);
}

export async function updateVariant(id: string, formData: FormData) {
  const r = VariantSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return issue(r);
  const d = r.data;
  const current = await prisma.product.findUnique({
    where: { id },
    select: { designId: true, design: { select: { code: true } } },
  });
  const code = current?.design?.code ?? "";
  await prisma.product.update({
    where: { id },
    data: {
      name: code ? variantName(code, d.width, d.colour) : d.width,
      width: d.width,
      colour: d.colour || null,
      gsm: d.gsm ?? null,
      costPrice: d.costPrice ?? null,
      salePrice: d.salePrice,
      currency: d.currency,
      stockQty: d.stockQty,
      unit: d.unit,
      sku: d.sku || null,
    },
  });
  revalidatePath("/products");
  if (current?.designId) revalidatePath(`/products/design/${current.designId}`);
  redirect(current?.designId ? `/products/design/${current.designId}` : "/products");
}

export async function deleteVariant(id: string) {
  const used = await prisma.orderItem.count({ where: { productId: id } });
  if (used > 0) return { error: "This width is used in orders and can't be deleted." };
  const v = await prisma.product.findUnique({ where: { id }, select: { designId: true } });
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
  if (v?.designId) revalidatePath(`/products/design/${v.designId}`);
  redirect(v?.designId ? `/products/design/${v.designId}` : "/products");
}
