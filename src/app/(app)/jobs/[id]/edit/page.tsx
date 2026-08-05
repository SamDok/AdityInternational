import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import JobForm from "../../JobForm";
import { updateJob } from "../../actions";
import { jobDocNo } from "@/lib/jobNumber";

export const dynamic = "force-dynamic";

const dateInput = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, vendors, productCount] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      include: { items: { orderBy: { id: "asc" }, include: { product: { select: { name: true, width: true, colour: true, design: { select: { code: true } } } } } } },
    }),
    prisma.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.count({ where: { archived: false } }),
  ]);
  if (!job) notFound();

  const initial = {
    vendorId: job.vendorId,
    kind: job.kind,
    currency: job.currency,
    issueDate: dateInput(job.issueDate),
    dueDate: dateInput(job.dueDate),
    notes: job.notes ?? "",
    items: job.items.map((it) => {
      // Prefer the stored per-piece value; reconstruct it for older lines.
      const per = it.perPieceQty != null ? it.perPieceQty : it.pieces && it.pieces > 0 ? it.qtyOrdered / it.pieces : it.qtyOrdered;
      return {
        id: it.id,
        productId: it.productId,
        productLabel: it.product.design
          ? `${it.product.design.code}${it.product.width ? ` · ${it.product.width}` : ""}${it.product.colour ? ` · ${it.product.colour}` : ""}`
          : it.product.name,
        pieces: it.pieces != null ? String(it.pieces) : "",
        perPieceQty: String(per),
        rate: it.rate != null ? String(it.rate) : "",
        unit: it.unit,
        dueDate: dateInput(it.dueDate),
        note: it.note ?? "",
      };
    }),
  };

  return (
    <div>
      <PageHeader title={`Edit job ${jobDocNo(job)}`} backHref={`/jobs/${job.id}`} />
      <JobForm
        vendors={vendors}
        hasProducts={productCount > 0}
        initial={initial}
        action={updateJob.bind(null, job.id)}
        submitLabel="Save changes"
      />
    </div>
  );
}
