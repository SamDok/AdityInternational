import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney, formatDate } from "@/lib/format";
import ReceiveForm from "../ReceiveForm";
import ToggleButton from "../../products/ToggleButton";
import DeleteButton from "@/components/DeleteButton";
import { cancelJob, deleteJob } from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-blue-100 text-blue-700" },
  PARTIAL: { label: "Partial", cls: "bg-amber-100 text-amber-700" },
  RECEIVED: { label: "Received", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { vendor: true, order: true, items: { include: { product: true } } },
  });
  if (!job) notFound();

  const s = STATUS[job.status] ?? { label: job.status, cls: "bg-gray-100 text-gray-700" };
  const total = job.items.reduce((sum, it) => sum + (it.rate ?? 0) * it.qtyOrdered, 0);
  const canReceive = job.status === "OPEN" || job.status === "PARTIAL";

  return (
    <div>
      <PageHeader title={`Job #${job.number}`} subtitle={job.vendor.name} backHref="/jobs" />

      <div className="space-y-4 p-4">
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{job.kind === "PURCHASE" ? "Purchase" : "Job work"} · {formatDate(job.issueDate)}</p>
            {job.dueDate && <p className="text-sm text-gray-500">Expected by {formatDate(job.dueDate)}</p>}
            <p className="mt-1 text-sm">
              <Link href={`/vendors/${job.vendorId}`} className="font-medium text-brand-600 hover:underline">{job.vendor.name}</Link>
            </p>
            {job.order && (
              <p className="mt-1 text-sm text-gray-500">
                From <Link href={`/orders/${job.orderId}`} className="font-medium text-brand-600 hover:underline">order #{job.order.number}</Link>
              </p>
            )}
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${s.cls}`}>{s.label}</span>
        </div>

        {canReceive && (
          <ReceiveForm
            jobId={job.id}
            items={job.items.map((it) => ({ id: it.id, label: it.product.name, qtyOrdered: it.qtyOrdered, qtyReceived: it.qtyReceived, unit: it.unit }))}
          />
        )}

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Items</h2>
          <ul className="space-y-2">
            {job.items.map((it) => (
              <li key={it.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {it.product.designId ? (
                        <Link href={`/products/design/${it.product.designId}`} className="hover:underline">{it.product.name}</Link>
                      ) : it.product.name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {it.qtyReceived}/{it.qtyOrdered} {it.unit} received
                      {it.rate != null ? ` · ${formatMoney(it.rate, job.currency)}/${it.unit}` : ""}
                    </p>
                  </div>
                  {it.rate != null && (
                    <p className="shrink-0 text-sm font-semibold text-gray-900">{formatMoney(it.rate * it.qtyOrdered, job.currency)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="card flex items-center justify-between">
          <span className="text-base font-semibold text-gray-700">Job value</span>
          <span className="text-xl font-bold text-gray-900">{formatMoney(total, job.currency)}</span>
        </div>

        {job.notes && (
          <section className="card">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="mt-1 text-sm text-gray-900">{job.notes}</p>
          </section>
        )}

        <div className="space-y-2 pt-2">
          {job.status !== "CANCELLED" && job.status !== "RECEIVED" && (
            <ToggleButton action={cancelJob.bind(null, job.id)} label="Cancel job" />
          )}
          <DeleteButton action={deleteJob.bind(null, job.id)} label="Delete job" confirmMessage={`Delete job #${job.number}? Stock already received stays. This can't be undone.`} />
        </div>
      </div>
    </div>
  );
}
