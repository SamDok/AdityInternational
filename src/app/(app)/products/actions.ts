"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applyMovements } from "@/lib/stock";
import { getCurrentUser, requireUser, isOwner } from "@/lib/auth";

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
  leadDays: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable().optional()),
  sortOrder: z.coerce.number().int().default(0),
});

export async function createCategory(formData: FormData) {
  await requireUser();
  const r = CategorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return issue(r);
  const exists = await prisma.productCategory.findFirst({
    where: { name: { equals: r.data.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists) return { error: `A type named "${r.data.name}" already exists.` };
  await prisma.productCategory.create({
    data: { name: r.data.name, hsnCode: r.data.hsnCode || null, leadDays: r.data.leadDays ?? null, sortOrder: r.data.sortOrder },
  });
  revalidatePath("/products");
  revalidatePath("/products/manage-types");
  return { ok: true };
}

export async function updateCategory(id: string, formData: FormData) {
  await requireUser();
  const r = CategorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return issue(r);
  const clash = await prisma.productCategory.findFirst({
    where: { name: { equals: r.data.name, mode: "insensitive" }, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { error: `Another type named "${r.data.name}" already exists.` };
  await prisma.productCategory.update({
    where: { id },
    data: { name: r.data.name, hsnCode: r.data.hsnCode || null, leadDays: r.data.leadDays ?? null, sortOrder: r.data.sortOrder },
  });
  revalidatePath("/products");
  revalidatePath("/products/manage-types");
  redirect("/products/manage-types");
}

export async function setCategoryArchived(id: string, archived: boolean) {
  await requireUser();
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
  gstRate: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable().optional()),
  leadDays: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable().optional()),
  description: str(),
  imageData: str(),
  sourcingType: str(),
  vendorId: str(),
});

async function designCodeTaken(code: string, exceptId?: string) {
  const m = await prisma.design.findFirst({
    where: { code: { equals: code, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return !!m;
}

export async function createDesign(formData: FormData) {
  await requireUser();
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
      gstRate: d.gstRate ?? null,
      leadDays: d.leadDays ?? null,
      description: d.description || null,
      imageData: d.imageData || null,
      sourcingType: d.sourcingType || null,
      vendorId: d.vendorId || null,
    },
  });
  revalidatePath("/products");
  redirect(`/products/design/${design.id}`);
}

export async function updateDesign(id: string, formData: FormData) {
  await requireUser();
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
      gstRate: d.gstRate ?? null,
      leadDays: d.leadDays ?? null,
      description: d.description || null,
      imageData: d.imageData || null,
      sourcingType: d.sourcingType || null,
      vendorId: d.vendorId || null,
    },
  });
  revalidatePath("/products");
  revalidatePath(`/products/design/${id}`);
  redirect(`/products/design/${id}`);
}

export async function setDesignArchived(id: string, archived: boolean) {
  await requireUser();
  await prisma.design.update({ where: { id }, data: { archived } });
  revalidatePath("/products");
  revalidatePath(`/products/design/${id}`);
}

export async function deleteDesign(id: string) {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can delete designs." };
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
  currency: z.string().trim().min(1).default("INR"),
  stockQty: z.coerce.number().default(0),
  reorderLevel: optionalNumber(),
  unit: z.string().trim().min(1).default("mtr"),
  sku: str(),
});

// Human-readable name for a variant, used on order lines.
function variantName(code: string, width: string, colour?: string | null) {
  return `${code} · ${width}${colour ? ` · ${colour}` : ""}`;
}

export async function createVariant(designId: string, formData: FormData) {
  await requireUser();
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
      currency: d.currency,
      stockQty: d.stockQty,
      reorderLevel: d.reorderLevel ?? null,
      unit: d.unit,
      sku: d.sku || null,
    },
  });
  revalidatePath("/products");
  revalidatePath(`/products/design/${designId}`);
  redirect(`/products/design/${designId}`);
}

export async function updateVariant(id: string, formData: FormData) {
  await requireUser();
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
      currency: d.currency,
      stockQty: d.stockQty,
      reorderLevel: d.reorderLevel ?? null,
      unit: d.unit,
      sku: d.sku || null,
    },
  });
  revalidatePath("/products");
  if (current?.designId) revalidatePath(`/products/design/${current.designId}`);
  redirect(current?.designId ? `/products/design/${current.designId}` : "/products");
}

export async function deleteVariant(id: string) {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can delete widths." };
  const [used, jobbed] = await Promise.all([
    prisma.orderItem.count({ where: { productId: id } }),
    prisma.jobItem.count({ where: { productId: id } }),
  ]);
  if (used > 0) return { error: "This width is used in orders and can't be deleted." };
  if (jobbed > 0) return { error: "This width is used on a job and can't be deleted." };
  const v = await prisma.product.findUnique({ where: { id }, select: { designId: true } });
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
  if (v?.designId) revalidatePath(`/products/design/${v.designId}`);
  redirect(v?.designId ? `/products/design/${v.designId}` : "/products");
}

const numOrNull = (v?: string) => {
  const n = parseFloat((v ?? "").trim());
  return isNaN(n) ? null : n;
};

// Create several width-variants for a design in one submit.
export async function createVariantsBulk(
  designId: string,
  rows: { width?: string; colour?: string; gsm?: string; costPrice?: string; stockQty?: string; unit?: string }[],
) {
  await requireUser();
  const design = await prisma.design.findUnique({ where: { id: designId }, select: { code: true } });
  if (!design) return { error: "Design not found." };
  let created = 0;
  for (const r of rows) {
    const width = (r.width ?? "").trim();
    if (!width) continue;
    const colour = (r.colour ?? "").trim() || null;
    await prisma.product.create({
      data: {
        designId,
        name: variantName(design.code, width, colour),
        width,
        colour,
        gsm: numOrNull(r.gsm),
        costPrice: numOrNull(r.costPrice),
        stockQty: numOrNull(r.stockQty) ?? 0,
        unit: (r.unit ?? "").trim() || "mtr",
        currency: "INR",
      },
    });
    created++;
  }
  revalidatePath(`/products/design/${designId}`);
  return { ok: true, created };
}

// Clone a design and all its widths under a new, unique code (stock reset to 0).
export async function duplicateDesign(id: string) {
  await requireUser();
  const src = await prisma.design.findUnique({ where: { id }, include: { variants: true } });
  if (!src) return { error: "Design not found." };
  const base = `${src.code}-COPY`;
  let code = base;
  let n = 1;
  while (await prisma.design.findFirst({ where: { code: { equals: code, mode: "insensitive" } }, select: { id: true } })) {
    n++;
    code = `${base}-${n}`;
  }
  const copy = await prisma.design.create({
    data: {
      categoryId: src.categoryId,
      code,
      name: src.name,
      composition: src.composition,
      hsnCode: src.hsnCode,
      description: src.description,
      imageData: src.imageData,
    },
  });
  for (const v of src.variants) {
    await prisma.product.create({
      data: {
        designId: copy.id,
        name: variantName(code, v.width ?? "", v.colour),
        width: v.width,
        colour: v.colour,
        gsm: v.gsm,
        costPrice: v.costPrice,
        currency: v.currency,
        stockQty: 0,
        reorderLevel: v.reorderLevel,
        unit: v.unit,
      },
    });
  }
  revalidatePath("/products");
  redirect(`/products/design/${copy.id}/edit`);
}

// Add to / subtract from a variant's stock (never below zero for manual edits).
export async function adjustStock(variantId: string, delta: number) {
  await requireUser();
  const v = await prisma.product.findUnique({ where: { id: variantId }, select: { stockQty: true, designId: true } });
  if (!v) return { error: "Not found." };
  // Clamp at zero, but log the delta that was actually applied.
  const stockQty = Math.max(0, v.stockQty + delta);
  const applied = stockQty - v.stockQty;
  if (applied !== 0) {
    const userId = (await getCurrentUser())?.id ?? null;
    await applyMovements([{ productId: variantId, delta: applied, reason: "MANUAL_ADJUST", userId }]);
  }
  if (v.designId) revalidatePath(`/products/design/${v.designId}`);
  revalidatePath("/products/low-stock");
  return { ok: true, stockQty };
}

// Whole-catalogue CSV export (one row per width-variant).
export async function exportProductsCsv(): Promise<string> {
  await requireUser();
  const rows = await prisma.product.findMany({
    include: { design: { include: { category: true } } },
    orderBy: { name: "asc" },
  });
  const header = ["type", "code", "composition", "hsn", "width", "colour", "gsm", "cost", "stock", "unit", "sku"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const p of rows) {
    lines.push([
      p.design?.category.name, p.design?.code, p.design?.composition, p.design?.hsnCode,
      p.width, p.colour, p.gsm, p.costPrice, p.stockQty, p.unit, p.sku,
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

// Bulk-import designs + widths from parsed spreadsheet rows.
export async function importProducts(rows: Record<string, string>[]) {
  await requireUser();
  const cats = await prisma.productCategory.findMany({ select: { id: true, name: true, sortOrder: true } });
  const catByName = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c.id]));
  let maxSort = cats.reduce((m, c) => Math.max(m, c.sortOrder), 0);
  const designs = await prisma.design.findMany({ select: { id: true, code: true } });
  const designByCode = new Map(designs.map((d) => [d.code.trim().toLowerCase(), d.id]));

  let designsCreated = 0;
  let variantsCreated = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const code = (r.code ?? "").trim();
    const width = (r.width ?? "").trim();
    if (!code || !width) { skipped++; continue; }

    const typeName = (r.type ?? "").trim();
    let categoryId: string | undefined;
    if (typeName) {
      categoryId = catByName.get(typeName.toLowerCase());
      if (!categoryId) {
        maxSort++;
        const c = await prisma.productCategory.create({ data: { name: typeName, sortOrder: maxSort } });
        categoryId = c.id;
        catByName.set(typeName.toLowerCase(), c.id);
      }
    }

    let designId = designByCode.get(code.toLowerCase());
    if (!designId) {
      if (!categoryId) { warnings.push(`Row ${line}: "${code}" has no type — skipped.`); skipped++; continue; }
      const d = await prisma.design.create({
        data: { categoryId, code, composition: (r.composition ?? "").trim() || null, hsnCode: (r.hsn ?? "").trim() || null },
      });
      designId = d.id;
      designByCode.set(code.toLowerCase(), d.id);
      designsCreated++;
    }

    const colour = (r.colour ?? "").trim() || null;
    await prisma.product.create({
      data: {
        designId,
        name: variantName(code, width, colour),
        width,
        colour,
        gsm: numOrNull(r.gsm),
        costPrice: numOrNull(r.cost),
        stockQty: numOrNull(r.stock) ?? 0,
        unit: (r.unit ?? "").trim() || "mtr",
        sku: (r.sku ?? "").trim() || null,
        currency: "INR",
      },
    });
    variantsCreated++;
  }

  revalidatePath("/products");
  return { designsCreated, variantsCreated, skipped, warnings };
}
