"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applyMovements, type StockMove } from "@/lib/stock";
import { getCurrentUser, requireUser, isOwner } from "@/lib/auth";
import { financialYearLabel } from "@/lib/jobNumber";

const ItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  qtyOrdered: z.coerce.number().min(0),
  rate: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable().optional()),
  dueDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  unit: z.string().min(1).default("mtr"),
});

// Common JobItem column data (no jobId) for create and update.
function jobItemData(it: z.infer<typeof ItemSchema>) {
  return {
    productId: it.productId,
    qtyOrdered: it.qtyOrdered,
    rate: it.rate ?? null,
    dueDate: toDate(it.dueDate) ?? null,
    note: it.note || null,
    unit: it.unit,
  };
}

function jobStatusFrom(items: { qtyOrdered: number; qtyReceived: number }[]): string {
  const allDone = items.every((i) => i.qtyReceived >= i.qtyOrdered);
  const anyReceived = items.some((i) => i.qtyReceived > 0);
  return allDone ? "RECEIVED" : anyReceived ? "PARTIAL" : "OPEN";
}

const JobSchema = z.object({
  vendorId: z.string().min(1, "Please choose a vendor"),
  kind: z.enum(["JOB_WORK", "PURCHASE"]).default("JOB_WORK"),
  currency: z.string().min(1).default("INR"),
  issueDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(ItemSchema).min(1, "Add at least one product line"),
});

export type JobInput = z.input<typeof JobSchema>;

function toDate(v?: string | null) {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

// Allocate a job's numbers: the global internal `number` plus the per-(kind,
// financial year) document `seq` and its `fyLabel`. Sequential callers each see
// the previous committed job, so max+1 is safe for this workload.
export async function allocateJobNumbers(kind: string, issueDate: Date) {
  const fyLabel = financialYearLabel(issueDate);
  const [lastNum, lastSeq] = await Promise.all([
    prisma.job.findFirst({ orderBy: { number: "desc" }, select: { number: true } }),
    prisma.job.findFirst({ where: { kind, fyLabel }, orderBy: { seq: "desc" }, select: { seq: true } }),
  ]);
  return { number: (lastNum?.number ?? 0) + 1, seq: (lastSeq?.seq ?? 0) + 1, fyLabel };
}

export async function createJob(input: JobInput) {
  await requireUser();
  const parsed = JobSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid job" };
  const d = parsed.data;
  const issueDate = toDate(d.issueDate) ?? new Date();
  const { number, seq, fyLabel } = await allocateJobNumbers(d.kind, issueDate);
  const job = await prisma.job.create({
    data: {
      number,
      seq,
      fyLabel,
      vendorId: d.vendorId,
      kind: d.kind,
      currency: d.currency,
      issueDate,
      dueDate: toDate(d.dueDate) ?? null,
      notes: d.notes || null,
      items: { create: d.items.map(jobItemData) },
    },
  });
  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
}

export async function updateJob(id: string, input: JobInput) {
  await requireUser();
  const parsed = JobSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid job" };
  const d = parsed.data;

  const current = await prisma.job.findUnique({ where: { id }, select: { status: true, items: { select: { id: true, qtyReceived: true } } } });
  if (!current) return { error: "Job not found." };
  if (current.status === "CANCELLED") return { error: "This job is cancelled and can't be edited." };

  const existingById = new Map(current.items.map((i) => [i.id, i]));
  const incomingIds = new Set(d.items.map((it) => it.id).filter(Boolean) as string[]);
  const toDelete = current.items.filter((i) => !incomingIds.has(i.id));
  if (toDelete.some((i) => i.qtyReceived > 0)) {
    return { error: "A line that's already been received can't be removed." };
  }
  for (const it of d.items) {
    const ex = it.id ? existingById.get(it.id) : undefined;
    if (ex && it.qtyOrdered < ex.qtyReceived) {
      return { error: `A line's quantity can't be less than what's already received (${ex.qtyReceived}).` };
    }
  }

  const newLines = d.items.filter((it) => !(it.id && existingById.has(it.id)));
  const ops = [];
  if (toDelete.length) ops.push(prisma.jobItem.deleteMany({ where: { id: { in: toDelete.map((i) => i.id) } } }));
  ops.push(prisma.job.update({
    where: { id },
    data: { vendorId: d.vendorId, kind: d.kind, currency: d.currency, issueDate: toDate(d.issueDate) ?? undefined, dueDate: toDate(d.dueDate) ?? null, notes: d.notes || null },
  }));
  for (const it of d.items) {
    if (it.id && existingById.has(it.id)) ops.push(prisma.jobItem.update({ where: { id: it.id }, data: jobItemData(it) }));
  }
  if (newLines.length) ops.push(prisma.jobItem.createMany({ data: newLines.map((it) => ({ jobId: id, ...jobItemData(it) })) }));
  await prisma.$transaction(ops);

  // Editing quantities can change the received/ordered balance — recompute status.
  const items = await prisma.jobItem.findMany({ where: { jobId: id }, select: { qtyOrdered: true, qtyReceived: true } });
  await prisma.job.update({ where: { id }, data: { status: jobStatusFrom(items) } });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  redirect(`/jobs/${id}`);
}

// Record received quantities (deltas) per line: add to stock and to qtyReceived,
// then recompute the job status.
export async function receiveJob(jobId: string, receipts: { itemId: string; received: number }[]) {
  await requireUser();
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { items: true } });
  if (!job) return { error: "Job not found." };
  if (job.status === "CANCELLED") return { error: "This job is cancelled." };

  const ops = [];
  const moves: StockMove[] = [];
  for (const r of receipts) {
    const item = job.items.find((i) => i.id === r.itemId);
    if (!item || !r.received || r.received <= 0) continue;
    ops.push(prisma.jobItem.update({ where: { id: item.id }, data: { qtyReceived: { increment: r.received } } }));
    moves.push({ productId: item.productId, delta: r.received, reason: "JOB_RECEIVE", jobId });
  }
  if (ops.length === 0) return { error: "Enter a quantity to receive." };
  await prisma.$transaction(ops);

  // Bring received goods into stock and log each as a movement (JOB_RECEIVE).
  const userId = (await getCurrentUser())?.id ?? null;
  await applyMovements(moves.map((m) => ({ ...m, userId })));

  // Recompute status from fresh totals.
  const items = await prisma.jobItem.findMany({ where: { jobId } });
  const allDone = items.every((i) => i.qtyReceived >= i.qtyOrdered);
  const anyReceived = items.some((i) => i.qtyReceived > 0);
  const status = allDone ? "RECEIVED" : anyReceived ? "PARTIAL" : "OPEN";
  await prisma.job.update({ where: { id: jobId }, data: { status } });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/products");
  return { ok: true };
}

export async function cancelJob(id: string) {
  await requireUser();
  await prisma.job.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
}

export async function deleteJob(id: string) {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can delete jobs." };
  await prisma.job.delete({ where: { id } }); // items cascade; stock already added stays
  revalidatePath("/jobs");
  redirect("/jobs");
}
