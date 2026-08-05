import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatDate, formatQty, roundMoney } from "@/lib/format";
import { jobDocNo } from "@/lib/jobNumber";
import { getCompanyProfile } from "../../(app)/settings/companyActions";
import PrintBar from "./PrintBar";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      vendor: true,
      order: { include: { customer: true } },
      items: { orderBy: { id: "asc" }, include: { product: { include: { design: true } } } },
    },
  });
  if (!job) notFound();

  const company = await getCompanyProfile();

  const isPurchase = job.kind === "PURCHASE";
  const title = isPurchase ? "Purchase Order" : "Job Work Order";
  const docNo = jobDocNo(job);
  const total = job.items.reduce((s, i) => s + roundMoney((i.rate ?? 0) * i.qtyOrdered), 0);
  const totalPieces = job.items.reduce((s, i) => s + (i.pieces ?? 0), 0);
  const hasRates = job.items.some((i) => i.rate != null);
  const cancelled = job.status === "CANCELLED";

  const v = job.vendor;
  const vendorContact = [v.contactPerson, v.altPhone || v.phone].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-gray-100">
      <PrintBar backHref={`/jobs/${job.id}`} backLabel="Back to job" />

      {cancelled && (
        <div className="mx-auto max-w-[820px] px-8 pt-6 print:px-0 print:pt-0">
          <p className="rounded border-2 border-red-600 bg-red-50 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-red-700">
            Cancelled — no longer active
          </p>
        </div>
      )}

      <div className="proforma mx-auto my-6 max-w-[820px] bg-white p-8 text-[13px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {/* Letterhead */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            {company.logoData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoData} alt="" className="h-16 w-16 object-contain" />
            )}
            <div>
              <p className="text-xl font-bold">{company.legalName || "Your Company"}</p>
              {company.address && <p className="whitespace-pre-line text-xs text-gray-600">{company.address}</p>}
              <p className="text-xs text-gray-600">
                {[company.phone, company.email, company.website].filter(Boolean).join("  ·  ")}
              </p>
              {company.gstin && <p className="text-xs text-gray-600">GSTIN: {company.gstin}</p>}
            </div>
          </div>
        </div>

        {/* Title + meta */}
        <div className="mt-5 flex items-end justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wide">{title}</h1>
          <div className="text-right text-xs">
            <p><span className="text-gray-500">No.:</span> <span className="font-semibold">{docNo}</span></p>
            <p><span className="text-gray-500">Date:</span> {formatDate(job.issueDate)}</p>
            {job.dueDate && <p><span className="text-gray-500">Expected by:</span> {formatDate(job.dueDate)}</p>}
          </div>
        </div>

        {/* Vendor */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {isPurchase ? "Supplier" : "Kaarigar"}
            </p>
            <p className="font-semibold">{v.name}</p>
            {vendorContact && <p className="text-xs text-gray-700">{vendorContact}</p>}
            {v.address && <p className="whitespace-pre-line text-xs text-gray-700">{v.address}</p>}
            {v.gstin && <p className="mt-1 text-xs text-gray-700">GSTIN: {v.gstin}</p>}
          </div>
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Details</p>
            {v.paymentTerms && <p className="text-xs text-gray-700">Payment terms: {v.paymentTerms}</p>}
            <p className="text-xs text-gray-700">Currency: {job.currency}</p>
            {job.order && <p className="text-xs text-gray-700">Against order #{job.order.number} · {job.order.customer.name}</p>}
          </div>
        </div>

        {/* Items */}
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border border-gray-300 px-2 py-1.5 text-center">#</th>
              <th className="border border-gray-300 px-2 py-1.5">Description</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Qty</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Pcs</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center">Due by</th>
              {hasRates && <th className="border border-gray-300 px-2 py-1.5 text-right">Rate</th>}
              {hasRates && <th className="border border-gray-300 px-2 py-1.5 text-right">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {job.items.map((it, i) => (
              <tr key={it.id} className="align-top">
                <td className="border border-gray-300 px-2 py-1.5 text-center">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-1.5">
                  <div className="flex items-start gap-2">
                    {it.product.design?.imageData && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.product.design.imageData} alt="" className="h-12 w-12 shrink-0 rounded object-cover ring-1 ring-gray-200" />
                    )}
                    <div>
                      <p className="font-medium">{it.product.name}</p>
                      {it.note && <p className="text-gray-600">{it.note}</p>}
                    </div>
                  </div>
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">
                  {formatQty(it.qtyOrdered)} {it.unit}
                  {it.pieces && it.perPieceQty != null && (
                    <span className="block text-[10px] text-gray-500">{it.pieces} × {formatQty(it.perPieceQty)}</span>
                  )}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{it.pieces ?? "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-center whitespace-nowrap">{it.dueDate ? formatDate(it.dueDate) : "—"}</td>
                {hasRates && <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{it.rate != null ? formatMoney(it.rate, job.currency) : "—"}</td>}
                {hasRates && <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{it.rate != null ? formatMoney(it.rate * it.qtyOrdered, job.currency) : "—"}</td>}
              </tr>
            ))}
          </tbody>
          {hasRates && (
            <tfoot>
              <tr className="font-semibold">
                <td className="border border-gray-300 px-2 py-1.5" colSpan={3}>Total</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{totalPieces || "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5"></td>
                <td className="border border-gray-300 px-2 py-1.5"></td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(total, job.currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Signature */}
        <div className="mt-6 flex items-start justify-end gap-6">
          <div className="min-w-[200px] pt-2 text-center text-xs">
            <p className="mb-12 font-semibold">For {company.legalName || "us"}</p>
            <div className="border-t border-gray-400 pt-1">{company.signatureName || "Authorised Signatory"}</div>
          </div>
        </div>

        {job.notes && (
          <p className="mt-4 text-xs text-gray-600"><span className="font-semibold">Notes:</span> {job.notes}</p>
        )}
        {company.footerNote && (
          <p className="mt-6 border-t border-gray-200 pt-3 text-center text-[11px] text-gray-500">{company.footerNote}</p>
        )}
      </div>
    </div>
  );
}
