import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatDate, formatMoney } from "@/lib/format";
import { jobDocNo, materialPoDocNo } from "@/lib/jobNumber";
import { jobReceivedValue, sumByCurrency, balances, allocateFIFO, paidState, PAID_LABEL, PAID_COLOR } from "@/lib/money";
import PaymentForm from "../../money/PaymentForm";
import PaymentList from "../../money/PaymentList";
import { recordVendorPayment, deleteVendorPayment } from "../../money/actions";
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
      jobs: { orderBy: { issueDate: "desc" }, take: 20, include: { items: { select: { rate: true, qtyOrdered: true, qtyReceived: true } } } },
      materialPos: { orderBy: { issueDate: "desc" }, take: 20, select: { id: true, number: true, seq: true, fyLabel: true, issueDate: true, currency: true, status: true, items: { select: { rate: true, qtyReceived: true } } } },
      designs: { orderBy: { code: "asc" }, take: 20, include: { category: true } },
      payments: { orderBy: { date: "desc" }, select: { id: true, amount: true, currency: true, date: true, method: true, reference: true, note: true, jobId: true, materialPoId: true } },
    },
  });
  if (!vendor) notFound();

  const waDigits = (vendor.altPhone || vendor.phone || "").replace(/[^\d]/g, "");
  const openJobs = vendor.jobs.filter((j) => j.status === "OPEN" || j.status === "PARTIAL");
  const openValue = openJobs.reduce((s, j) => s + j.items.reduce((a, i) => a + (i.rate ?? 0) * i.qtyOrdered, 0), 0);

  // Payables: value of goods received — both job work AND material purchases —
  // is what we owe this vendor. Both feed the balances, FIFO and payment lists.
  type Bill = { id: string; docNo: string; date: Date; currency: string; total: number; kind: "jobId" | "materialPoId"; href: string };
  const jobBills: Bill[] = vendor.jobs
    .filter((j) => j.status !== "CANCELLED")
    .map((j) => ({ id: j.id, docNo: jobDocNo(j), date: j.issueDate, currency: j.currency, total: jobReceivedValue(j), kind: "jobId" as const, href: `/jobs/${j.id}` }))
    .filter((j) => j.total > 0.01);
  const materialBills: Bill[] = vendor.materialPos
    .filter((po) => po.status !== "CANCELLED")
    .map((po) => ({
      id: po.id, docNo: materialPoDocNo(po), date: po.issueDate, currency: po.currency,
      total: Math.round(po.items.reduce((s, i) => s + (i.rate ?? 0) * i.qtyReceived, 0) * 100) / 100,
      kind: "materialPoId" as const, href: `/material-po/${po.id}`,
    }))
    .filter((po) => po.total > 0.01);
  const bills = [...jobBills, ...materialBills];
  const billedV = sumByCurrency(bills.map((b) => ({ amount: b.total, currency: b.currency })));
  const paidV = sumByCurrency(vendor.payments);
  const bsV = balances(billedV, paidV);
  // FIFO oldest-first across all bill types, per currency.
  const paidPerBill = new Map<string, number>();
  for (const [cur, total] of paidV) {
    const bs = bills.filter((b) => b.currency === cur).sort((a, b) => +a.date - +b.date);
    const alloc = allocateFIFO(bs.map((b) => ({ id: b.id, total: b.total })), total);
    for (const [bid, amt] of alloc) paidPerBill.set(bid, amt);
  }
  const billsByDate = [...bills].sort((a, b) => +b.date - +a.date);
  const vpaymentRows = vendor.payments.map((p) => ({
    ...p,
    against: p.jobId ? bills.find((b) => b.id === p.jobId)?.docNo ?? null
      : p.materialPoId ? bills.find((b) => b.id === p.materialPoId)?.docNo ?? null : null,
  }));
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

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-gray-500">Money</h2>
            {bills.length > 0 && (
              <Link href={`/statement/vendor/${vendor.id}`} className="text-sm font-medium text-brand-600 hover:underline">Statement</Link>
            )}
          </div>
          {bsV.length === 0 ? (
            <p className="card text-sm text-gray-500">Nothing received to pay for yet.</p>
          ) : (
            <div className="card space-y-2">
              {bsV.map((b) => (
                <div key={b.currency} className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-500">Received {formatMoney(b.billed, b.currency)} · Paid {formatMoney(b.paid, b.currency)}</span>
                  <span className={`text-base font-bold ${b.outstanding > 0.01 ? "text-red-700" : "text-green-700"}`}>
                    {b.outstanding > 0.01 ? `${formatMoney(b.outstanding, b.currency)} to pay` : "Settled"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {billsByDate.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-2xl bg-white ring-1 ring-gray-100">
              {billsByDate.map((jb) => {
                const st = paidState(jb.total, paidPerBill.get(jb.id) ?? 0);
                return (
                  <li key={jb.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Link href={jb.href} className="min-w-0 flex-1 hover:underline">
                      <span className="text-sm font-medium text-gray-900">{jb.docNo}</span>
                      <span className="ml-2 text-xs text-gray-500">{formatDate(jb.date)}</span>
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAID_COLOR[st]}`}>{PAID_LABEL[st]}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(jb.total, jb.currency)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <PaymentForm
            action={recordVendorPayment.bind(null, vendor.id)}
            defaultCurrency={vendor.currency}
            allocations={billsByDate.map((b) => ({ id: b.id, label: `${b.docNo} · ${formatMoney(b.total, b.currency)}`, key: b.kind }))}
            allocationLabel="Against bill"
            buttonLabel="Record vendor payment"
          />
          {vpaymentRows.length > 0 && <PaymentList payments={vpaymentRows} onDelete={deleteVendorPayment} />}
        </section>

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
