import { prisma } from "@/lib/prisma";
import { fulfillmentOf } from "@/lib/format";
import { jobDocNo } from "@/lib/jobNumber";

// One order line's procurement view: how much is needed, what's coverable from
// stock (and jobs already raised for this order), and the shortfall to make/buy.
export type ProcLine = {
  productId: string;
  name: string;
  needed: number;
  available: number; // current stock on hand for this variant
  shortfall: number; // needed minus what stock + existing linked jobs already cover
  perPieceQty: number | null; // the order line's per-piece size, to keep the job piece-wise
  dueDate: Date | null;
  rate: number | null; // variant cost — the making/purchase rate to seed the job
  currency: string; // the variant's cost currency
  unit: string;
};

export type ProcKind = "JOB_WORK" | "PURCHASE";

export type ProcGroup = {
  vendorId: string;
  vendorName: string;
  kind: ProcKind;
  lines: ProcLine[];
  jobDueDate: Date | null; // earliest line due date in the group
};

export type ExistingJob = { id: string; number: number; docNo: string; vendorName: string; status: string; kind: string };

export type ProcPlan = {
  orderNumber: number;
  groups: ProcGroup[]; // ready to generate, one job per vendor + kind
  unassigned: ProcLine[]; // short, but the design has no vendor/sourcing set
  inStock: ProcLine[]; // fully covered — no job needed
  existingJobs: ExistingJob[]; // jobs already raised for this order
};

function earliest(dates: (Date | null)[]): Date | null {
  const valid = dates.filter((d): d is Date => d != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a < b ? a : b));
}

// Work out what needs making / buying for an order: per line, the shortfall
// after current stock and any jobs already raised for THIS order, grouped by the
// design's assigned kaarigar (job work) or supplier (trading). Shortfall-only.
export async function planProcurement(orderId: string): Promise<ProcPlan | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { include: { design: { include: { vendor: true } } } } } },
    },
  });
  if (!order) return null;

  const existingJobs = await prisma.job.findMany({
    where: { orderId },
    include: { vendor: true, items: true },
    orderBy: { number: "asc" },
  });

  // Coverage pool per product = current stock + quantity already on this order's jobs.
  const linkedByProduct = new Map<string, number>();
  for (const j of existingJobs) {
    for (const it of j.items) {
      linkedByProduct.set(it.productId, (linkedByProduct.get(it.productId) ?? 0) + it.qtyOrdered);
    }
  }
  const pool = new Map<string, number>();

  const groupsMap = new Map<string, ProcGroup>();
  const unassigned: ProcLine[] = [];
  const inStock: ProcLine[] = [];

  for (const it of order.items) {
    const pid = it.productId;
    const prod = it.product;
    const design = prod.design;
    if (!pool.has(pid)) pool.set(pid, (prod.stockQty || 0) + (linkedByProduct.get(pid) ?? 0));
    const cover = pool.get(pid)!;
    const use = Math.min(it.quantity, cover);
    pool.set(pid, cover - use);
    const shortfall = it.quantity - use;

    const line: ProcLine = {
      productId: pid,
      name: prod.name,
      needed: it.quantity,
      available: prod.stockQty,
      shortfall,
      perPieceQty: it.perPieceQty ?? null,
      dueDate: it.dueDate ?? order.dueDate,
      rate: prod.costPrice ?? null,
      currency: prod.currency,
      unit: prod.unit,
    };

    if (shortfall <= 1e-9) { inStock.push(line); continue; }
    if (!design?.vendorId || !design?.sourcingType) { unassigned.push(line); continue; }

    const kind: ProcKind = design.sourcingType === "JOB_WORK" ? "JOB_WORK" : "PURCHASE";
    const key = `${design.vendorId}|${kind}`;
    let group = groupsMap.get(key);
    if (!group) {
      group = { vendorId: design.vendorId, vendorName: design.vendor?.name ?? "Vendor", kind, lines: [], jobDueDate: null };
      groupsMap.set(key, group);
    }
    group.lines.push(line);
  }

  const groups = [...groupsMap.values()].map((g) => ({ ...g, jobDueDate: earliest(g.lines.map((l) => l.dueDate)) }));

  return {
    orderNumber: order.number,
    groups,
    unassigned,
    inStock,
    existingJobs: existingJobs.map((j) => ({ id: j.id, number: j.number, docNo: jobDocNo(j), vendorName: j.vendor.name, status: j.status, kind: j.kind })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Business-wide procurement board — computed from a fixed handful of bulk
// queries (NOT per-order), so it stays fast with hundreds of live orders.

export type NeedGroup = { vendorId: string; vendorName: string; kind: ProcKind; lines: { productId: string; name: string; shortfall: number; unit: string }[] };
export type OrderNeed = { orderId: string; number: number; customerId: string; customerName: string; dueDate: Date | null; groups: NeedGroup[]; unassignedCount: number; vendorIds: string[] };
export type AwaitingItem = { productName: string; outstanding: number; unit: string; jobId: string; jobNumber: number; jobDocNo: string; orderNumber: number | null; orderId: string | null; dueDate: Date | null; overdue: boolean };
export type AwaitingVendor = { vendorId: string; vendorName: string; items: AwaitingItem[]; anyOverdue: boolean };
export type DesignRollup = { productId: string; name: string; unit: string; demand: number; stock: number; onOrder: number; toProcure: number };

export type ProcurementBoard = {
  needs: OrderNeed[];
  awaiting: AwaitingVendor[];
  rollup: DesignRollup[];
  vendorOpts: { id: string; name: string }[];
  customerOpts: { id: string; name: string }[];
};

export async function procurementBoard(): Promise<ProcurementBoard> {
  // 1. Active confirmed orders + their line items (one query).
  const orders = await prisma.order.findMany({
    where: { status: "CONFIRMED" },
    select: {
      id: true, number: true, dueDate: true, manualComplete: true,
      customer: { select: { id: true, name: true } },
      items: { select: { productId: true, quantity: true, shippedQty: true } },
    },
    orderBy: { number: "asc" },
  });
  const active = orders.filter((o) => !o.manualComplete && fulfillmentOf(o.items) !== "FULL");
  const orderIds = active.map((o) => o.id);

  // 2. The products those orders reference, with sourcing (one query).
  const pidSet = new Set<string>();
  for (const o of active) for (const it of o.items) pidSet.add(it.productId);
  const products = pidSet.size
    ? await prisma.product.findMany({
        where: { id: { in: [...pidSet] } },
        select: { id: true, name: true, unit: true, stockQty: true, design: { select: { vendorId: true, sourcingType: true, vendor: { select: { id: true, name: true } } } } },
      })
    : [];
  const pmap = new Map(products.map((p) => [p.id, p]));

  // 3. Jobs already raised for these orders (one query) — already-covered per (order, product).
  const linkedJobs = orderIds.length
    ? await prisma.job.findMany({ where: { orderId: { in: orderIds }, status: { not: "CANCELLED" } }, select: { orderId: true, items: { select: { productId: true, qtyOrdered: true } } } })
    : [];
  const linked = new Map<string, number>();
  for (const j of linkedJobs) for (const it of j.items) {
    const k = `${j.orderId}:${it.productId}`;
    linked.set(k, (linked.get(k) ?? 0) + it.qtyOrdered);
  }

  // 4. All open/partial jobs (one query) — the "awaiting" side + aggregate on-order.
  const openJobs = await prisma.job.findMany({
    where: { status: { in: ["OPEN", "PARTIAL"] } },
    include: { vendor: { select: { id: true, name: true } }, order: { select: { id: true, number: true } }, items: { include: { product: { select: { name: true } } } } },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
  });

  // Per-order needs (same shortfall logic as planProcurement, but from bulk data).
  const needs: OrderNeed[] = [];
  for (const o of active) {
    const pool = new Map<string, number>();
    const groups = new Map<string, NeedGroup>();
    let unassignedCount = 0;
    for (const it of o.items) {
      const prod = pmap.get(it.productId);
      if (!prod) continue;
      if (!pool.has(it.productId)) pool.set(it.productId, (prod.stockQty || 0) + (linked.get(`${o.id}:${it.productId}`) ?? 0));
      const cover = pool.get(it.productId)!;
      const use = Math.min(it.quantity, cover);
      pool.set(it.productId, cover - use);
      const shortfall = it.quantity - use;
      if (shortfall <= 1e-9) continue;
      const d = prod.design;
      if (!d?.vendorId || !d?.sourcingType) { unassignedCount++; continue; }
      const kind: ProcKind = d.sourcingType === "JOB_WORK" ? "JOB_WORK" : "PURCHASE";
      const gk = `${d.vendorId}|${kind}`;
      let g = groups.get(gk);
      if (!g) { g = { vendorId: d.vendorId, vendorName: d.vendor?.name ?? "Vendor", kind, lines: [] }; groups.set(gk, g); }
      g.lines.push({ productId: it.productId, name: prod.name, shortfall, unit: prod.unit });
    }
    if (groups.size || unassignedCount) {
      needs.push({ orderId: o.id, number: o.number, customerId: o.customer.id, customerName: o.customer.name, dueDate: o.dueDate, groups: [...groups.values()], unassignedCount, vendorIds: [...groups.values()].map((g) => g.vendorId) });
    }
  }

  // Awaiting, grouped by vendor.
  const now = new Date();
  const avMap = new Map<string, AwaitingVendor>();
  const openByProduct = new Map<string, number>();
  for (const j of openJobs) {
    const outstanding = j.items.filter((i) => i.qtyReceived < i.qtyOrdered);
    for (const i of j.items) openByProduct.set(i.productId, (openByProduct.get(i.productId) ?? 0) + Math.max(0, i.qtyOrdered - i.qtyReceived));
    if (outstanding.length === 0) continue;
    const overdue = !!(j.dueDate && j.dueDate < now);
    let av = avMap.get(j.vendorId);
    if (!av) { av = { vendorId: j.vendorId, vendorName: j.vendor.name, items: [], anyOverdue: false }; avMap.set(j.vendorId, av); }
    for (const i of outstanding) {
      av.items.push({ productName: i.product.name, outstanding: i.qtyOrdered - i.qtyReceived, unit: i.unit, jobId: j.id, jobNumber: j.number, jobDocNo: jobDocNo(j), orderNumber: j.order?.number ?? null, orderId: j.order?.id ?? null, dueDate: j.dueDate, overdue });
    }
    if (overdue) av.anyOverdue = true;
  }
  const awaiting = [...avMap.values()];

  // By-design rollup: true aggregate net demand across all live orders.
  const demand = new Map<string, number>();
  for (const o of active) for (const it of o.items) demand.set(it.productId, (demand.get(it.productId) ?? 0) + it.quantity);
  const rollup: DesignRollup[] = [];
  for (const [pid, dem] of demand) {
    const prod = pmap.get(pid);
    if (!prod) continue;
    const onOrder = openByProduct.get(pid) ?? 0;
    const stock = prod.stockQty || 0;
    const toProcure = dem - stock - onOrder;
    if (toProcure > 1e-9) rollup.push({ productId: pid, name: prod.name, unit: prod.unit, demand: dem, stock, onOrder, toProcure });
  }
  rollup.sort((a, b) => b.toProcure - a.toProcure);

  const vendorOpts = [...new Map(products.filter((p) => p.design?.vendor).map((p) => [p.design!.vendor!.id, p.design!.vendor!.name]))].map(([id, name]) => ({ id, name }));
  const customerOpts = [...new Map(active.map((o) => [o.customer.id, o.customer.name] as const))].map(([id, name]) => ({ id, name }));

  return { needs, awaiting, rollup, vendorOpts, customerOpts };
}
