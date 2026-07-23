"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applyMovements, type StockMove } from "@/lib/stock";
import { getCurrentUser, requireUser } from "@/lib/auth";

const ItemSchema = z.object({
  productId: z.string().min(1),
  qtyOrdered: z.coerce.number().min(0),
  rate: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable().optional()),
  unit: z.string().min(1).default("mtr"),
});

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

async function nextJobNumber() {
  const last = await prisma.job.findFirst({ orderBy: { number: "desc" } });
  return last ? last.number + 1 : 1;
}

export async function createJob(input: JobInput) {
  await requireUser();
  const parsed = JobSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid job" };
  const d = parsed.data;
  const number = await nextJobNumber();
  const job = await prisma.job.create({
    data: {
      number,
      vendorId: d.vendorId,
      kind: d.kind,
      currency: d.currency,
      issueDate: toDate(d.issueDate) ?? new Date(),
      dueDate: toDate(d.dueDate) ?? null,
      notes: d.notes || null,
      items: {
        create: d.items.map((it) => ({
          productId: it.productId,
          qtyOrdered: it.qtyOrdered,
          rate: it.rate ?? null,
          unit: it.unit,
        })),
      },
    },
  });
  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
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
  await prisma.job.delete({ where: { id } }); // items cascade; stock already added stays
  revalidatePath("/jobs");
  redirect("/jobs");
}
