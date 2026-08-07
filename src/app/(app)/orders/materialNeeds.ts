import { prisma } from "@/lib/prisma";
import { roundQty } from "@/lib/format";

export type MaterialNeed = {
  materialId: string;
  name: string;
  unit: string;
  needed: number; // estimated base-fabric requirement for open job-work orders
  inStock: number;
  short: number; // max(0, needed - inStock)
};

// Estimated base-fabric requirement to cover open (confirmed, not-yet-shipped)
// job-work order lines, so the planner can flag fabric to buy/issue before a job
// can start. Estimate: 1 unit of base fabric per 1 unit finished, unless a
// per-piece factor is set on the type/design default. Only BASE_FABRIC is
// quantified (embellishment consumption isn't modelled — that was left out of scope).
export async function baseFabricNeeds(): Promise<MaterialNeed[]> {
  const orders = await prisma.order.findMany({
    where: { status: "CONFIRMED", isSample: false },
    select: {
      manualComplete: true,
      items: { select: { quantity: true, shippedQty: true, product: { select: { design: { select: { id: true, categoryId: true, sourcingType: true } } } } } },
    },
  });

  // Remaining finished quantity per job-work design.
  const remainingByDesign = new Map<string, number>();
  const catOfDesign = new Map<string, string>();
  for (const o of orders) {
    if (o.manualComplete) continue;
    for (const it of o.items) {
      const d = it.product.design;
      if (!d || d.sourcingType !== "JOB_WORK") continue;
      const rem = Math.max(0, it.quantity - it.shippedQty);
      if (rem <= 0) continue;
      remainingByDesign.set(d.id, (remainingByDesign.get(d.id) ?? 0) + rem);
      catOfDesign.set(d.id, d.categoryId);
    }
  }
  if (remainingByDesign.size === 0) return [];

  const designIds = [...remainingByDesign.keys()];
  const catIds = [...new Set([...catOfDesign.values()])];
  const [overrides, catDefaults] = await Promise.all([
    prisma.designMaterial.findMany({ where: { designId: { in: designIds }, material: { kind: "BASE_FABRIC" } }, select: { designId: true, materialId: true, qtyPerPiece: true } }),
    prisma.categoryMaterial.findMany({ where: { categoryId: { in: catIds }, material: { kind: "BASE_FABRIC" } }, select: { categoryId: true, materialId: true, qtyPerPiece: true } }),
  ]);
  const overrideByDesign = new Map<string, { materialId: string; qtyPerPiece: number | null }[]>();
  for (const o of overrides) {
    const arr = overrideByDesign.get(o.designId) ?? [];
    arr.push({ materialId: o.materialId, qtyPerPiece: o.qtyPerPiece });
    overrideByDesign.set(o.designId, arr);
  }
  const defaultsByCat = new Map<string, { materialId: string; qtyPerPiece: number | null }[]>();
  for (const c of catDefaults) {
    const arr = defaultsByCat.get(c.categoryId) ?? [];
    arr.push({ materialId: c.materialId, qtyPerPiece: c.qtyPerPiece });
    defaultsByCat.set(c.categoryId, arr);
  }

  // Aggregate needed base fabric per material.
  const neededByMaterial = new Map<string, number>();
  for (const [designId, remaining] of remainingByDesign) {
    const mats = overrideByDesign.get(designId) ?? defaultsByCat.get(catOfDesign.get(designId)!) ?? [];
    for (const m of mats) {
      const need = remaining * (m.qtyPerPiece && m.qtyPerPiece > 0 ? m.qtyPerPiece : 1);
      neededByMaterial.set(m.materialId, (neededByMaterial.get(m.materialId) ?? 0) + need);
    }
  }
  if (neededByMaterial.size === 0) return [];

  const materials = await prisma.rawMaterial.findMany({
    where: { id: { in: [...neededByMaterial.keys()] } },
    select: { id: true, name: true, unit: true, stockQty: true },
  });

  return materials
    .map((m) => {
      const needed = roundQty(neededByMaterial.get(m.id) ?? 0);
      return { materialId: m.id, name: m.name, unit: m.unit, needed, inStock: m.stockQty, short: roundQty(Math.max(0, needed - m.stockQty)) };
    })
    .sort((a, b) => b.short - a.short || b.needed - a.needed);
}
