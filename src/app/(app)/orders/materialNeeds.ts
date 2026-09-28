import { prisma } from "@/lib/prisma";
import { roundQty } from "@/lib/format";

export type MaterialNeed = {
  materialId: string;
  name: string;
  unit: string;
  needed: number; // fabric STILL to issue = estimated requirement minus what's already been issued
  issued: number; // base fabric already issued (net of returns) to these orders' jobs
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
      id: true, manualComplete: true,
      items: { select: { quantity: true, shippedQty: true, product: { select: { design: { select: { id: true, categoryId: true, sourcingType: true } } } } } },
    },
  });

  // Remaining finished quantity per job-work design + the orders in play.
  const remainingByDesign = new Map<string, number>();
  const catOfDesign = new Map<string, string>();
  const openOrderIds = new Set<string>();
  for (const o of orders) {
    if (o.manualComplete) continue;
    for (const it of o.items) {
      const d = it.product.design;
      if (!d || d.sourcingType !== "JOB_WORK") continue;
      const rem = Math.max(0, it.quantity - it.shippedQty);
      if (rem <= 0) continue;
      remainingByDesign.set(d.id, (remainingByDesign.get(d.id) ?? 0) + rem);
      catOfDesign.set(d.id, d.categoryId);
      openOrderIds.add(o.id);
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

  // Gross base-fabric requirement per (design, material). Kept per-design so the
  // fabric issued for one design can only offset THAT design's need — never
  // another design that happens to share the same base fabric, and never a
  // design in the same order that's already been shipped.
  const grossByDesignMat = new Map<string, Map<string, number>>();
  for (const [designId, remaining] of remainingByDesign) {
    const mats = overrideByDesign.get(designId) ?? defaultsByCat.get(catOfDesign.get(designId)!) ?? [];
    if (mats.length === 0) continue;
    const inner = new Map<string, number>();
    for (const m of mats) {
      const need = remaining * (m.qtyPerPiece && m.qtyPerPiece > 0 ? m.qtyPerPiece : 1);
      inner.set(m.materialId, (inner.get(m.materialId) ?? 0) + need);
    }
    grossByDesignMat.set(designId, inner);
  }
  if (grossByDesignMat.size === 0) return [];

  // Base fabric already issued (net of returns), attributed to the SAME design it
  // was issued for — and only for designs that still have work remaining. Fabric
  // issued to a now-shipped design in the same order is ignored, since it doesn't
  // reduce what's left to issue for the open work.
  const issuedRows = openOrderIds.size
    ? await prisma.jobMaterial.findMany({
        where: {
          material: { kind: "BASE_FABRIC" },
          job: { orderId: { in: [...openOrderIds] } },
          jobItem: { product: { designId: { in: designIds } } },
        },
        select: { materialId: true, qtyIssued: true, qtyReturned: true, jobItem: { select: { product: { select: { designId: true } } } } },
      })
    : [];
  const issuedByDesignMat = new Map<string, Map<string, number>>();
  for (const r of issuedRows) {
    const did = r.jobItem.product.designId;
    if (!did) continue;
    const inner = issuedByDesignMat.get(did) ?? new Map<string, number>();
    inner.set(r.materialId, (inner.get(r.materialId) ?? 0) + Math.max(0, r.qtyIssued - r.qtyReturned));
    issuedByDesignMat.set(did, inner);
  }

  // Net per design, then roll up to each material.
  const neededByMaterial = new Map<string, number>(); // still to issue
  const coveredByMaterial = new Map<string, number>(); // already issued against open work
  for (const [designId, mats] of grossByDesignMat) {
    const issuedInner = issuedByDesignMat.get(designId);
    for (const [materialId, gross] of mats) {
      // Clamp per design so an over-issued design can't create a surplus that
      // hides another design's shortfall.
      const issued = Math.min(gross, issuedInner?.get(materialId) ?? 0);
      neededByMaterial.set(materialId, (neededByMaterial.get(materialId) ?? 0) + Math.max(0, gross - issued));
      coveredByMaterial.set(materialId, (coveredByMaterial.get(materialId) ?? 0) + issued);
    }
  }
  if (neededByMaterial.size === 0) return [];

  const materials = await prisma.rawMaterial.findMany({
    where: { id: { in: [...neededByMaterial.keys()] } },
    select: { id: true, name: true, unit: true, stockQty: true },
  });

  return materials
    .map((m) => {
      const needed = roundQty(neededByMaterial.get(m.id) ?? 0); // still to issue
      const issued = roundQty(coveredByMaterial.get(m.id) ?? 0);
      return { materialId: m.id, name: m.name, unit: m.unit, needed, issued, inStock: m.stockQty, short: roundQty(Math.max(0, needed - m.stockQty)) };
    })
    .filter((m) => m.needed > 1e-9) // fully-issued fabrics are done — drop them
    .sort((a, b) => b.short - a.short || b.needed - a.needed);
}
