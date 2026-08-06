"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applyMovements, type StockMove } from "@/lib/stock";
import { applyMaterialMovements } from "@/lib/materials";
import { getCurrentUser, requireUser, isOwner } from "@/lib/auth";
import { financialYearLabel } from "@/lib/jobNumber";

// A line is entered piece-wise like an order line: `pieces` pieces of
// `perPieceQty` each. qtyOrdered = (pieces || 1) × perPieceQty; pieces blank
// means a loose quantity. `id` marks lines that already exist (edit in place).
const ItemSchema = z
  .object({
    id: z.string().optional(),
    productId: z.string().min(1),
    pieces: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable().optional()),
    perPieceQty: z.coerce.number().min(0),
    rate: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable().optional()),
    dueDate: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    unit: z.string().min(1).default("mtr"),
  })
  .transform((it) => {
    const pieces = it.pieces && it.pieces > 0 ? it.pieces : null;
    const qtyOrdered = (pieces ?? 1) * it.perPieceQty;
    return { ...it, pieces, qtyOrdered };
  });

// Common JobItem column data (no jobId) for create and update.
function jobItemData(it: z.infer<typeof ItemSchema>) {
  return {
    productId: it.productId,
    pieces: it.pieces ?? null,
    perPieceQty: it.perPieceQty,
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

// Record a receipt per line: the actual measured metres (which need not equal
// pieces × nominal), the piece count, and the weight. Metres go into stock; a
// piece-wise line completes once all its pieces are in.
export async function receiveJob(
  jobId: string,
  receipts: { itemId: string; pieces?: number | null; meters: number; weight?: number | null }[],
) {
  await requireUser();
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { items: true } });
  if (!job) return { error: "Job not found." };
  if (job.status === "CANCELLED") return { error: "This job is cancelled." };

  const ops = [];
  const moves: StockMove[] = [];
  for (const r of receipts) {
    const item = job.items.find((i) => i.id === r.itemId);
    if (!item) continue;
    const meters = r.meters > 0 ? r.meters : 0;
    const pieces = r.pieces && r.pieces > 0 ? r.pieces : 0;
    const weight = r.weight && r.weight > 0 ? r.weight : null;
    if (meters <= 0 && pieces <= 0 && weight == null) continue; // nothing entered
    ops.push(prisma.jobItem.update({
      where: { id: item.id },
      data: {
        qtyReceived: { increment: meters },
        piecesReceived: { increment: pieces },
        ...(weight != null ? { weightReceived: { increment: weight } } : {}),
      },
    }));
    moves.push({ productId: item.productId, delta: meters, pieces: pieces || null, weight, reason: "JOB_RECEIVE", jobId });
  }
  if (ops.length === 0) return { error: "Enter what you received." };
  await prisma.$transaction(ops);

  // Bring received metres into stock and log each as a movement (JOB_RECEIVE).
  const userId = (await getCurrentUser())?.id ?? null;
  await applyMovements(moves.map((m) => ({ ...m, userId })));

  // Completion: a piece-wise line is done once all pieces are in; a loose line by metres.
  const items = await prisma.jobItem.findMany({ where: { jobId } });
  const allDone = items.every((i) => (i.pieces != null ? i.piecesReceived >= i.pieces : i.qtyReceived >= i.qtyOrdered));
  const anyReceived = items.some((i) => i.piecesReceived > 0 || i.qtyReceived > 0);
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

// Close a short-delivered job: the vendor won't send the rest, so treat what
// arrived as final (keeps whatever's in stock, stops it showing as outstanding
// in procurement / due-soon). Only meaningful for an open or partial job.
export async function closeJobShort(id: string) {
  await requireUser();
  const job = await prisma.job.findUnique({ where: { id }, select: { status: true } });
  if (!job) return { error: "Job not found." };
  if (job.status === "CANCELLED") return { error: "This job is cancelled." };
  if (job.status === "RECEIVED") return { error: "This job is already complete." };
  await prisma.job.update({ where: { id }, data: { status: "RECEIVED" } });
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  revalidatePath("/procurement");
  revalidatePath("/");
}

// Record a quality rejection: goods already received are found defective and
// sent back. Stock goes down, the job's received total drops (so what we owe the
// vendor falls with it), and the line reopens for a fresh delivery.
export async function recordRejection(jobId: string, lines: { itemId: string; qty: number; pieces?: number | null }[]) {
  await requireUser();
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { items: true } });
  if (!job) return { error: "Job not found." };
  if (job.status === "CANCELLED") return { error: "This job is cancelled." };

  const byId = new Map(job.items.map((it) => [it.id, it]));
  const work = lines
    .map((l) => ({ it: byId.get(l.itemId), qty: l.qty, pieces: l.pieces ?? null }))
    .filter((w): w is { it: NonNullable<typeof w.it>; qty: number; pieces: number | null } => !!w.it && w.qty > 0);
  if (work.length === 0) return { error: "Enter a quantity to reject." };
  for (const w of work) {
    if (w.qty > w.it.qtyReceived + 1e-9) return { error: `Can't reject more than the ${w.it.qtyReceived} received on a line.` };
  }

  const userId = (await getCurrentUser())?.id ?? null;
  const moves: StockMove[] = [];
  const ops = [];
  for (const w of work) {
    const frac = w.it.qtyReceived > 0 ? w.qty / w.it.qtyReceived : 0;
    const weightBack = Math.round(w.it.weightReceived * frac * 1000) / 1000;
    const piecesBack = w.pieces ?? (w.it.piecesReceived ? Math.round(w.it.piecesReceived * frac) : 0);
    ops.push(prisma.jobItem.update({
      where: { id: w.it.id },
      data: {
        qtyReceived: { decrement: w.qty },
        piecesReceived: { decrement: piecesBack },
        weightReceived: { decrement: weightBack },
      },
    }));
    moves.push({ productId: w.it.productId, delta: -w.qty, pieces: piecesBack ? -piecesBack : null, weight: weightBack ? -weightBack : null, reason: "VENDOR_REJECT", jobId, userId });
  }
  await applyMovements(moves);
  await prisma.$transaction(ops);

  const items = await prisma.jobItem.findMany({ where: { jobId } });
  const allDone = items.every((i) => (i.pieces != null ? i.piecesReceived >= i.pieces : i.qtyReceived >= i.qtyOrdered));
  const anyReceived = items.some((i) => i.piecesReceived > 0 || i.qtyReceived > 0);
  await prisma.job.update({ where: { id: jobId }, data: { status: allDone ? "RECEIVED" : anyReceived ? "PARTIAL" : "OPEN" } });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/products");
  revalidatePath("/money");
  return { ok: true };
}

export async function deleteJob(id: string) {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can delete jobs." };
  await prisma.job.delete({ where: { id } }); // items cascade; stock already added stays
  revalidatePath("/jobs");
  redirect("/jobs");
}

// ------------------------------------------------------------- Materials issue
// Issue raw materials to the kaarigar for one design line of a job. Deducts
// material stock (ISSUE_TO_JOB) and records each on JobMaterial. Lines with
// nothing issued simply stay "materials pending".
export async function issueJobMaterials(
  jobItemId: string,
  lines: { materialId: string; qty: number; note?: string | null }[],
) {
  await requireUser();
  const jobItem = await prisma.jobItem.findUnique({ where: { id: jobItemId }, select: { id: true, jobId: true, job: { select: { status: true } } } });
  if (!jobItem) return { error: "Line not found." };
  if (jobItem.job.status === "CANCELLED") return { error: "This job is cancelled." };

  const clean = lines.filter((l) => l.materialId && l.qty > 0);
  if (clean.length === 0) return { error: "Enter what you're issuing." };

  const materials = await prisma.rawMaterial.findMany({ where: { id: { in: clean.map((l) => l.materialId) } }, select: { id: true, unit: true } });
  const unitOf = new Map(materials.map((m) => [m.id, m.unit]));
  const userId = (await getCurrentUser())?.id ?? null;

  await prisma.$transaction(
    clean.map((l) =>
      prisma.jobMaterial.create({
        data: { jobId: jobItem.jobId, jobItemId, materialId: l.materialId, qtyIssued: l.qty, unit: unitOf.get(l.materialId) ?? "mtr", note: l.note || null },
      }),
    ),
  );
  await applyMaterialMovements(clean.map((l) => ({ materialId: l.materialId, delta: -l.qty, reason: "ISSUE_TO_JOB" as const, jobId: jobItem.jobId, userId })));

  revalidatePath(`/jobs/${jobItem.jobId}`);
  revalidatePath("/materials");
  return { ok: true };
}

// Return unused material from a job line back into stock (RETURN_FROM_JOB).
export async function returnJobMaterial(jobMaterialId: string, qty: number) {
  await requireUser();
  if (!(qty > 0)) return { error: "Enter a quantity to return." };
  const jm = await prisma.jobMaterial.findUnique({ where: { id: jobMaterialId } });
  if (!jm) return { error: "Not found." };
  const remaining = jm.qtyIssued - jm.qtyReturned;
  if (qty > remaining + 1e-9) return { error: `Only ${remaining} ${jm.unit} left to return.` };
  const userId = (await getCurrentUser())?.id ?? null;
  await prisma.jobMaterial.update({ where: { id: jobMaterialId }, data: { qtyReturned: { increment: qty } } });
  await applyMaterialMovements([{ materialId: jm.materialId, delta: qty, reason: "RETURN_FROM_JOB", jobId: jm.jobId, userId }]);
  revalidatePath(`/jobs/${jm.jobId}`);
  revalidatePath("/materials");
  return { ok: true };
}
