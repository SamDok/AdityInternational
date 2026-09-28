import { prisma } from "@/lib/prisma";
import { roundQty, orderNo } from "@/lib/format";

// One order+design line that contributes to a fabric's "still to issue" figure —
// so the panel can show WHERE the number comes from.
export type NeedContributor = {
  orderId: string;
  orderLabel: string; // AI/25-26/001
  designCode: string;
  gross: number; // estimated fabric this order+design needs (finished remaining × per-piece)
  issued: number; // fabric already issued to it (clamped to gross)
  still: number; // gross − issued
};

export type MaterialNeed = {
  materialId: string;
  name: string;
  unit: string;
  needed: number; // fabric STILL to issue across all open orders
  issued: number; // already issued against open work (that counts toward the need)
  inStock: number;
  short: number; // max(0, needed - inStock)
  contributors: NeedContributor[]; // the order+design lines making up `needed`
};

// Estimated base-fabric requirement to cover open (confirmed, not-yet-shipped)
// job-work order lines, so the planner can flag fabric to buy/issue before a job
// can start. Estimate: 1 unit of base fabric per 1 unit finished, unless a
// per-piece factor is set on the type/design default. Requirement and issued
// fabric are matched per (order, design) so one line can never mask another.
export async function baseFabricNeeds(): Promise<MaterialNeed[]> {
  const orders = await prisma.order.findMany({
    where: { status: "CONFIRMED", isSample: false },
    select: {
      id: true, number: true, seq: true, fyLabel: true, isSample: true, sampleNo: true, manualComplete: true,
      items: { select: { quantity: true, shippedQty: true, product: { select: { design: { select: { id: true, code: true, categoryId: true, sourcingType: true } } } } } },
    },
  });

  // Remaining finished quantity per (order, design), with labels for the breakdown.
  type Rem = { orderId: string; orderLabel: string; designId: string; designCode: string; categoryId: string; qty: number };
  const remaining = new Map<string, Rem>(); // key `${orderId}|${designId}`
  for (const o of orders) {
    if (o.manualComplete) continue;
    const orderLabel = orderNo(o);
    for (const it of o.items) {
      const d = it.product.design;
      if (!d || d.sourcingType !== "JOB_WORK") continue;
      const rem = Math.max(0, it.quantity - it.shippedQty);
      if (rem <= 0) continue;
      const k = `${o.id}|${d.id}`;
      const cur = remaining.get(k);
      if (cur) cur.qty += rem;
      else remaining.set(k, { orderId: o.id, orderLabel, designId: d.id, designCode: d.code, categoryId: d.categoryId, qty: rem });
    }
  }
  if (remaining.size === 0) return [];

  const designIds = [...new Set([...remaining.values()].map((r) => r.designId))];
  const catIds = [...new Set([...remaining.values()].map((r) => r.categoryId))];
  const orderIds = [...new Set([...remaining.values()].map((r) => r.orderId))];
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
  const matsFor = (designId: string, categoryId: string) => overrideByDesign.get(designId) ?? defaultsByCat.get(categoryId) ?? [];

  // Fabric already issued (net of returns), attributed to the exact (order, design,
  // material) it was issued for.
  const issuedRows = orderIds.length
    ? await prisma.jobMaterial.findMany({
        where: {
          material: { kind: "BASE_FABRIC" },
          job: { orderId: { in: orderIds } },
          jobItem: { product: { designId: { in: designIds } } },
        },
        select: { materialId: true, qtyIssued: true, qtyReturned: true, job: { select: { orderId: true } }, jobItem: { select: { product: { select: { designId: true } } } } },
      })
    : [];
  const issuedMap = new Map<string, number>(); // `${orderId}|${designId}|${materialId}`
  for (const r of issuedRows) {
    const oid = r.job.orderId; const did = r.jobItem.product.designId;
    if (!oid || !did) continue;
    const k = `${oid}|${did}|${r.materialId}`;
    issuedMap.set(k, (issuedMap.get(k) ?? 0) + Math.max(0, r.qtyIssued - r.qtyReturned));
  }

  // Net per (order, design, material), then roll up to each material.
  type Agg = { needed: number; covered: number; contributors: NeedContributor[] };
  const perMaterial = new Map<string, Agg>();
  for (const r of remaining.values()) {
    for (const m of matsFor(r.designId, r.categoryId)) {
      const gross = r.qty * (m.qtyPerPiece && m.qtyPerPiece > 0 ? m.qtyPerPiece : 1);
      const issued = Math.min(gross, issuedMap.get(`${r.orderId}|${r.designId}|${m.materialId}`) ?? 0);
      const still = Math.max(0, gross - issued);
      const pm = perMaterial.get(m.materialId) ?? { needed: 0, covered: 0, contributors: [] };
      pm.needed += still;
      pm.covered += issued;
      pm.contributors.push({ orderId: r.orderId, orderLabel: r.orderLabel, designCode: r.designCode, gross, issued, still });
      perMaterial.set(m.materialId, pm);
    }
  }
  if (perMaterial.size === 0) return [];

  const materials = await prisma.rawMaterial.findMany({
    where: { id: { in: [...perMaterial.keys()] } },
    select: { id: true, name: true, unit: true, stockQty: true },
  });

  return materials
    .map((m) => {
      const pm = perMaterial.get(m.id)!;
      const needed = roundQty(pm.needed);
      const issued = roundQty(pm.covered);
      const contributors = pm.contributors
        .filter((c) => c.still > 1e-9)
        .map((c) => ({ ...c, gross: roundQty(c.gross), issued: roundQty(c.issued), still: roundQty(c.still) }))
        .sort((a, b) => b.still - a.still);
      return { materialId: m.id, name: m.name, unit: m.unit, needed, issued, inStock: m.stockQty, short: roundQty(Math.max(0, needed - m.stockQty)), contributors };
    })
    .filter((m) => m.needed > 1e-9) // fully-issued fabrics are done — drop them
    .sort((a, b) => b.short - a.short || b.needed - a.needed);
}
