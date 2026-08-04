import { prisma } from "@/lib/prisma";
import { roundQty } from "@/lib/format";
import { jobDocNo } from "@/lib/jobNumber";

// Readiness of an unshipped line toward its delivery date.
export type Readiness = "READY" | "MAKING" | "NOT_PROCURED";
export type Bucket = "OVERDUE" | "BEHIND" | "SOON";

export type ScheduleItem = {
  orderId: string;
  orderNumber: number;
  customerName: string;
  productName: string;
  remaining: number;
  unit: string;
  deliveryDate: Date; // the line's due date (or the order's)
  startBy: Date | null; // deliveryDate minus lead time, when a lead time is known
  leadDays: number | null;
  readiness: Readiness;
  jobNumber: number | null; // when MAKING, the job it's on
  jobDocNo: string | null;
  jobId: string | null;
  jobDueDate: Date | null;
  jobLate: boolean; // job's date lands after the delivery date
  jobOverdue: boolean; // job's own due date has already passed (chase the vendor)
  bucket: Bucket;
};

export type Schedule = {
  overdue: ScheduleItem[];
  behind: ScheduleItem[];
  soon: ScheduleItem[];
  counts: { overdue: number; behind: number; soon: number };
};

const DAY = 86400000;
const SOON_WINDOW_DAYS = 7;
const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

// Business-wide delivery schedule with readiness, from a few bulk queries.
export async function dueSoonSchedule(): Promise<Schedule> {
  const orders = await prisma.order.findMany({
    where: { status: "CONFIRMED", manualComplete: false },
    select: {
      id: true, number: true, dueDate: true,
      customer: { select: { name: true } },
      items: {
        select: {
          productId: true, quantity: true, shippedQty: true, dueDate: true, unit: true,
          product: { select: { name: true, stockQty: true, design: { select: { leadDays: true, vendor: { select: { leadDays: true } }, category: { select: { leadDays: true } } } } } },
        },
      },
    },
    orderBy: { number: "asc" },
  });

  // Open/partial jobs linked to orders → per (order, product) outstanding + the
  // binding (latest) job date.
  const jobs = await prisma.job.findMany({
    where: { status: { in: ["OPEN", "PARTIAL"] }, orderId: { not: null } },
    select: { id: true, number: true, seq: true, fyLabel: true, kind: true, dueDate: true, orderId: true, items: { select: { productId: true, qtyOrdered: true, qtyReceived: true } } },
  });
  type JobCover = { outstanding: number; jobId: string; jobNumber: number; jobDocNo: string; jobDue: Date | null };
  const cover = new Map<string, JobCover>();
  for (const j of jobs) {
    for (const it of j.items) {
      const out = it.qtyOrdered - it.qtyReceived;
      if (out <= 0) continue;
      const k = `${j.orderId}:${it.productId}`;
      const prev = cover.get(k);
      if (!prev) {
        cover.set(k, { outstanding: out, jobId: j.id, jobNumber: j.number, jobDocNo: jobDocNo(j), jobDue: j.dueDate });
      } else {
        prev.outstanding += out;
        // Keep the latest date (the constraint) and its job for the link.
        if (j.dueDate && (!prev.jobDue || j.dueDate > prev.jobDue)) { prev.jobDue = j.dueDate; prev.jobId = j.id; prev.jobNumber = j.number; prev.jobDocNo = jobDocNo(j); }
      }
    }
  }

  const today = dayStart(new Date());
  const items: ScheduleItem[] = [];

  // Flatten every unshipped, schedulable line, then allocate the shared stock to
  // the MOST URGENT deliveries first — so a product in short supply is counted
  // once, not once per order. Job coverage stays per (order, product).
  type Line = { o: (typeof orders)[number]; it: (typeof orders)[number]["items"][number]; remaining: number; due: Date };
  const lines: Line[] = [];
  for (const o of orders) {
    for (const it of o.items) {
      const remaining = it.quantity - it.shippedQty;
      if (remaining <= 1e-9) continue; // already shipped
      const due = it.dueDate ?? o.dueDate;
      if (!due) continue; // nothing to schedule against
      lines.push({ o, it, remaining, due });
    }
  }
  lines.sort((a, b) => dayStart(a.due) - dayStart(b.due));

  const stockPool = new Map<string, number>(); // GLOBAL, per product
  const jobPool = new Map<string, number>(); // per order:product

  for (const { o, it, remaining, due } of lines) {
    const pid = it.productId;
    if (!stockPool.has(pid)) stockPool.set(pid, it.product.stockQty || 0);
    const jc = cover.get(`${o.id}:${pid}`);
    const jkey = `${o.id}:${pid}`;
    if (!jobPool.has(jkey)) jobPool.set(jkey, jc?.outstanding ?? 0);

    const fromStock = Math.min(remaining, stockPool.get(pid)!);
    stockPool.set(pid, stockPool.get(pid)! - fromStock);
    const rem2 = remaining - fromStock;
    const fromJob = Math.min(rem2, jobPool.get(jkey)!);
    jobPool.set(jkey, jobPool.get(jkey)! - fromJob);

    let readiness: Readiness;
    if (fromStock >= remaining - 1e-9) readiness = "READY";
    else if (fromStock + fromJob >= remaining - 1e-9) readiness = "MAKING";
    else readiness = "NOT_PROCURED";

    const leadDays = it.product.design?.leadDays ?? it.product.design?.vendor?.leadDays ?? it.product.design?.category.leadDays ?? null;
    const dDay = dayStart(due);
    const startBy = leadDays != null ? dDay - leadDays * DAY : null;
    const withinSoon = (d: number) => d <= today + SOON_WINDOW_DAYS * DAY;

    const jobDue = readiness === "MAKING" ? jc?.jobDue ?? null : null;
    const jobDueDay = jobDue ? dayStart(jobDue) : null;
    const jobLate = !!(jobDueDay != null && jobDueDay > dDay); // arrives after the deadline
    const jobOverdue = !!(jobDueDay != null && jobDueDay < today); // job's own date already passed

    let bucket: Bucket | null = null;
    if (dDay < today) {
      bucket = "OVERDUE"; // delivery date already passed, whatever the readiness
    } else if (readiness === "MAKING") {
      // Judge a being-made line by when its JOB will actually arrive, not the
      // original start-by. A job on track to land in time needs no attention.
      if (jobDueDay == null) {
        // No ETA on the job — fall back to the planning start-by, conservatively.
        const u = startBy ?? dDay;
        bucket = u < today ? "BEHIND" : withinSoon(u) ? "SOON" : null;
      } else if (jobOverdue || jobLate) {
        bucket = "BEHIND"; // vendor is late, or the job lands after the deadline
      } else {
        bucket = null; // arrives in time — drop off the board
      }
    } else if (readiness === "NOT_PROCURED" && leadDays == null) {
      // No lead time to plan by — always surface (with a nudge), never hide it
      // behind the 7-day window.
      bucket = "SOON";
    } else {
      // READY, or NOT_PROCURED with a known lead time.
      const u = readiness === "READY" ? dDay : (startBy ?? dDay);
      bucket = u < today ? "BEHIND" : withinSoon(u) ? "SOON" : null;
    }
    if (!bucket) continue;

    items.push({
      orderId: o.id, orderNumber: o.number, customerName: o.customer.name,
      productName: it.product.name, remaining: roundQty(remaining), unit: it.unit,
      deliveryDate: due, startBy: startBy != null ? new Date(startBy) : null, leadDays,
      readiness, jobNumber: readiness === "MAKING" ? jc?.jobNumber ?? null : null,
      jobDocNo: readiness === "MAKING" ? jc?.jobDocNo ?? null : null,
      jobId: readiness === "MAKING" ? jc?.jobId ?? null : null, jobDueDate: jobDue, jobLate, jobOverdue, bucket,
    });
  }

  const byUrgency = (a: ScheduleItem, b: ScheduleItem) => dayStart(a.deliveryDate) - dayStart(b.deliveryDate);
  const overdue = items.filter((i) => i.bucket === "OVERDUE").sort(byUrgency);
  const behind = items.filter((i) => i.bucket === "BEHIND").sort(byUrgency);
  const soon = items.filter((i) => i.bucket === "SOON").sort(byUrgency);

  return { overdue, behind, soon, counts: { overdue: overdue.length, behind: behind.length, soon: soon.length } };
}
