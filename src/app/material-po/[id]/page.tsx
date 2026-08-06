import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatDate, formatQty, roundMoney } from "@/lib/format";
import { materialPoDocNo } from "@/lib/jobNumber";
import { getCompanyProfile } from "../../(app)/settings/companyActions";
import PrintBar from "../../po/[id]/PrintBar";

export const dynamic = "force-dynamic";

export default async function MaterialPoPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const po = await prisma.materialPurchaseOrder.findUnique({
    where: { id },
    include: { vendor: true, items: { orderBy: { createdAt: "asc" }, include: { material: { select: { name: true, hsnCode: true } } } } },
  });
  if (!po) notFound();

  const company = await getCompanyProfile();
  const docNo = materialPoDocNo(po);
  const total = po.items.reduce((s, i) => s + roundMoney((i.rate ?? 0) * i.qtyOrdered), 0);
  const hasRates = po.items.some((i) => i.rate != null);
  const cancelled = po.status === "CANCELLED";
  const v = po.vendor;
  const vendorContact = [v.contactPerson, v.altPhone || v.phone].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-gray-100">
      <PrintBar backHref={`/material-orders/${po.id}`} backLabel="Back to PO" />

      {cancelled && (
        <div className="mx-auto max-w-[820px] px-8 pt-6 print:px-0 print:pt-0">
          <p className="rounded border-2 border-red-600 bg-red-50 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-red-700">Cancelled — no longer active</p>
        </div>
      )}

      <div className="proforma mx-auto my-6 max-w-[820px] bg-white p-8 text-[13px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            {company.logoData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoData} alt="" className="h-16 w-16 object-contain" />
            )}
            <div>
              <p className="text-xl font-bold">{company.legalName || "Your Company"}</p>
              {company.address && <p className="whitespace-pre-line text-xs text-gray-600">{company.address}</p>}
              <p className="text-xs text-gray-600">{[company.phone, company.email, company.website].filter(Boolean).join("  ·  ")}</p>
              {company.gstin && <p className="text-xs text-gray-600">GSTIN: {company.gstin}</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wide">Purchase Order — Materials</h1>
          <div className="text-right text-xs">
            <p><span className="text-gray-500">No.:</span> <span className="font-semibold">{docNo}</span></p>
            <p><span className="text-gray-500">Date:</span> {formatDate(po.issueDate)}</p>
            {po.dueDate && <p><span className="text-gray-500">Expected by:</span> {formatDate(po.dueDate)}</p>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Supplier</p>
            <p className="font-semibold">{v.name}</p>
            {vendorContact && <p className="text-xs text-gray-700">{vendorContact}</p>}
            {v.address && <p className="whitespace-pre-line text-xs text-gray-700">{v.address}</p>}
            {v.gstin && <p className="mt-1 text-xs text-gray-700">GSTIN: {v.gstin}</p>}
          </div>
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Details</p>
            {v.paymentTerms && <p className="text-xs text-gray-700">Payment terms: {v.paymentTerms}</p>}
            <p className="text-xs text-gray-700">Currency: {po.currency}</p>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border border-gray-300 px-2 py-1.5 text-center">#</th>
              <th className="border border-gray-300 px-2 py-1.5">Material</th>
              <th className="border border-gray-300 px-2 py-1.5">HSN</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Qty</th>
              {hasRates && <th className="border border-gray-300 px-2 py-1.5 text-right">Rate</th>}
              {hasRates && <th className="border border-gray-300 px-2 py-1.5 text-right">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {po.items.map((it, i) => (
              <tr key={it.id} className="align-top">
                <td className="border border-gray-300 px-2 py-1.5 text-center">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-1.5">
                  <p className="font-medium">{it.material.name}</p>
                  {it.note && <p className="text-gray-600">{it.note}</p>}
                </td>
                <td className="border border-gray-300 px-2 py-1.5">{it.material.hsnCode ?? "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatQty(it.qtyOrdered)} {it.unit}</td>
                {hasRates && <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{it.rate != null ? formatMoney(it.rate, po.currency) : "—"}</td>}
                {hasRates && <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{it.rate != null ? formatMoney(it.rate * it.qtyOrdered, po.currency) : "—"}</td>}
              </tr>
            ))}
          </tbody>
          {hasRates && (
            <tfoot>
              <tr className="font-semibold">
                <td className="border border-gray-300 px-2 py-1.5" colSpan={4}>Total</td>
                <td className="border border-gray-300 px-2 py-1.5"></td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(total, po.currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {po.notes && <p className="mt-4 whitespace-pre-line text-xs text-gray-600">{po.notes}</p>}

        <div className="mt-10 flex justify-end">
          <div className="text-center text-xs">
            <div className="mb-1 h-10 w-40 border-b border-gray-400" />
            <p className="text-gray-600">For {company.legalName || "Your Company"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
