import { prisma } from "@/lib/prisma";

// One order line's procurement view: how much is needed, what's coverable from
// stock (and jobs already raised for this order), and the shortfall to make/buy.
export type ProcLine = {
  productId: string;
  name: string;
  needed: number;
  available: number; // current stock on hand for this variant
  shortfall: number; // needed minus what stock + existing linked jobs already cover
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

export type ExistingJob = { id: string; number: number; vendorName: string; status: string; kind: string };

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
    existingJobs: existingJobs.map((j) => ({ id: j.id, number: j.number, vendorName: j.vendor.name, status: j.status, kind: j.kind })),
  };
}
