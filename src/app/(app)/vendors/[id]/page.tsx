import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatDate, formatMoney } from "@/lib/format";
import { jobDocNo } from "@/lib/jobNumber";
import { ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { KAARIGAR: "Kaarigar", SUPPLIER: "Supplier", BOTH: "Kaarigar & Supplier" };
const STATUS_LABEL: Record<string, string> = { OPEN: "Open", PARTIAL: "Partial", RECEIVED: "Received", CANCELLED: "Cancelled" };

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      jobs: { orderBy: { issueDate: "desc" }, take: 20, include: { items: { select: { rate: true, qtyOrdered: true } } } },
      designs: { orderBy: { code: "asc" }, take: 20, include: { category: true } },
    },
  });
  if (!vendor) notFound();

  const waDigits = (vendor.altPhone || vendor.phone || "").replace(/[^\d]/g, "");
  const openJobs = vendor.jobs.filter((j) => j.status === "OPEN" || j.status === "PARTIAL");
  const openValue = openJobs.reduce((s, j) => s + j.items.reduce((a, i) => a + (i.rate ?? 0) * i.qtyOrdered, 0), 0);
  const bank = [
    ["Bank", vendor.bankName],
    ["Account name", vendor.bankAccountName],
    ["Account no.", vendor.bankAccountNo],
    ["IFSC", vendor.bankIfsc],
    ["SWIFT", vendor.bankSwift],
    ["Branch", vendor.bankBranch],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div>
      <PageHeader
        title={vendor.name}
        subtitle={[vendor.code, KIND_LABEL[vendor.kind]].filter(Boolean).join(" · ")}
        backHref="/vendors"
        action={<Link href={`/vendors/${vendor.id}/edit`} className="btn-secondary !px-4 !py-2 text-sm">Edit</Link>}
      />

      <div className="space-y-4 p-4">
        {vendor.archived && (
          <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">This vendor is archived.</div>
        )}

        <div className="flex flex-wrap gap-2">
          {vendor.phone && <a href={`tel:${vendor.phone}`} className="btn-secondary flex-1 !py-2 text-sm">Call</a>}
          {waDigits && <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 !py-2 text-sm">WhatsApp</a>}
          {vendor.email && <a href={`mailto:${vendor.email}`} className="btn-secondary flex-1 !py-2 text-sm">Email</a>}
        </div>
        <Link href={`/jobs/new?vendorId=${vendor.id}`} className="btn-primary w-full">New job for this vendor</Link>

        {openJobs.length > 0 && (
          <div className="card flex items-center justify-between bg-brand-50">
            <span className="text-sm font-semibold text-brand-900">Open value · {openJobs.length} job{openJobs.length > 1 ? "s" : ""}</span>
            <span className="text-lg font-bold text-brand-900">{formatMoney(openValue, vendor.currency)}</span>
          </div>
        )}

        <section className="card divide-y divide-gray-50">
          <Row label="Type" value={KIND_LABEL[vendor.kind]} />
          <Row label="Contact person" value={vendor.contactPerson} />
          <Row label="Phone" value={vendor.phone} />
          <Row label="WhatsApp / alt" value={vendor.altPhone} />
          <Row label="Email" value={vendor.email} />
          <Row label="Address" value={vendor.address} />
          <Row label="Country" value={vendor.country} />
          <Row label="GSTIN" value={vendor.gstin} />
          <Row label="Pay in" value={vendor.currency} />
          <Row label="Payment terms" value={vendor.paymentTerms} />
          <Row label="Lead time" value={vendor.leadDays != null ? `${vendor.leadDays} days` : null} />
          <Row label="Notes" value={vendor.notes} />
        </section>

        {bank.length > 0 && (
          <section className="card divide-y divide-gray-50">
            <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Bank details</p>
            {bank.map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </section>
        )}

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Jobs ({vendor.jobs.length})</h2>
          {vendor.jobs.length === 0 ? (
            <p className="card text-sm text-gray-500">No jobs yet.</p>
          ) : (
            <ul className="space-y-2">
              {vendor.jobs.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">Job {jobDocNo(j)}</p>
                      <p className="text-sm text-gray-500">{formatDate(j.issueDate)}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{STATUS_LABEL[j.status] ?? j.status}</span>
                    <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {vendor.designs.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Designs assigned ({vendor.designs.length})</h2>
            <ul className="space-y-2">
              {vendor.designs.map((d) => (
                <li key={d.id}>
                  <Link href={`/products/design/${d.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">{d.code}{d.name ? ` · ${d.name}` : ""}</p>
                      <p className="text-sm text-gray-500">{d.category.name}</p>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
