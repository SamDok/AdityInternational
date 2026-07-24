import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import JobForm from "../../JobForm";
import { updateJob } from "../../actions";
import { getProductOptions } from "../../../orders/productOptions";

export const dynamic = "force-dynamic";

const dateInput = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, vendors, products] = await Promise.all([
    prisma.job.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } } } }),
    prisma.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getProductOptions(),
  ]);
  if (!job) notFound();

  const initial = {
    vendorId: job.vendorId,
    kind: job.kind,
    currency: job.currency,
    issueDate: dateInput(job.issueDate),
    dueDate: dateInput(job.dueDate),
    notes: job.notes ?? "",
    items: job.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      qty: String(it.qtyOrdered),
      rate: it.rate != null ? String(it.rate) : "",
      unit: it.unit,
      dueDate: dateInput(it.dueDate),
      note: it.note ?? "",
    })),
  };

  return (
    <div>
      <PageHeader title={`Edit job #${job.number}`} backHref={`/jobs/${job.id}`} />
      <JobForm
        vendors={vendors}
        products={products.map((p) => ({ id: p.id, label: p.label, group: p.group, unit: p.unit }))}
        initial={initial}
        action={updateJob.bind(null, job.id)}
        submitLabel="Save changes"
      />
    </div>
  );
}
