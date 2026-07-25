import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatDate } from "@/lib/format";
import { shipmentDocNo } from "@/lib/jobNumber";
import { getCompanyProfile } from "../../(app)/settings/companyActions";
import DocPrintBar from "@/components/DocPrintBar";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ shipmentId: string }> }) {
  await requireUser();
  const { shipmentId } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { customer: true, items: { orderBy: { createdAt: "asc" }, include: { product: { include: { design: true } } } } },
  });
  if (!shipment) notFound();

  const [company, bankAccount] = await Promise.all([
    getCompanyProfile(),
    prisma.bankAccount.findUnique({ where: { currency: shipment.currency } }),
  ]);

  const total = shipment.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const totalPieces = shipment.items.reduce((s, i) => s + (i.pieces ?? 0), 0);
  const totalNet = shipment.items.reduce((s, i) => s + i.netWeight, 0);

  const billToName = shipment.billToName || shipment.customer.company || shipment.customer.name;
  const billToAddress = shipment.billToAddress || shipment.customer.address;
  const hasShipTo = shipment.shipToName || shipment.shipToAddress || shipment.destinationPort || shipment.incoterms;

  const bank = (bankAccount
    ? [
        ["Bank", bankAccount.bankName],
        ["Account name", bankAccount.accountName],
        ["Account no.", bankAccount.accountNo],
        ["SWIFT / BIC", bankAccount.swift],
        ["IFSC", bankAccount.ifsc],
        ["IBAN", bankAccount.iban],
        ["Branch", bankAccount.branch],
        ["Bank address", bankAccount.bankAddress],
      ]
    : []
  ).filter(([, v]) => v) as [string, string][];

  return (
    <div className="min-h-screen bg-gray-100">
      <DocPrintBar backHref={`/shipments/${shipment.id}`} backLabel="Back to shipment" />

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
          <h1 className="text-lg font-bold uppercase tracking-wide">Commercial Invoice</h1>
          <div className="text-right text-xs">
            <p><span className="text-gray-500">No.:</span> <span className="font-semibold">{shipmentDocNo(shipment, "INV")}</span></p>
            <p><span className="text-gray-500">Date:</span> {formatDate(shipment.date)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Bill To</p>
            <p className="font-semibold">{billToName}</p>
            {billToAddress && <p className="whitespace-pre-line text-xs text-gray-700">{billToAddress}</p>}
            {shipment.billToTaxId && <p className="mt-1 text-xs text-gray-700">GST/Tax ID: {shipment.billToTaxId}</p>}
          </div>
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Ship To</p>
            {hasShipTo ? (
              <>
                {shipment.shipToName && <p className="font-semibold">{shipment.shipToName}</p>}
                {shipment.shipToAddress && <p className="whitespace-pre-line text-xs text-gray-700">{shipment.shipToAddress}</p>}
                {shipment.destinationPort && <p className="mt-1 text-xs text-gray-700">Port of discharge: {shipment.destinationPort}</p>}
                {shipment.incoterms && <p className="text-xs text-gray-700">Incoterms: {shipment.incoterms}</p>}
              </>
            ) : (
              <p className="text-xs text-gray-500">Same as Bill To</p>
            )}
          </div>
        </div>

        {shipment.paymentTerms && <p className="mt-3 text-xs"><span className="font-semibold">Payment terms:</span> {shipment.paymentTerms}</p>}

        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border border-gray-300 px-2 py-1.5 text-center">#</th>
              <th className="border border-gray-300 px-2 py-1.5">Description</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center">HSN</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Qty</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Pcs</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Rate</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {shipment.items.map((it, i) => (
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
                      {it.description && <p className="text-gray-600">{it.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center">{it.product.design?.hsnCode || "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{it.quantity} {it.unit}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{it.pieces ?? "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(it.rate, shipment.currency)}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(it.quantity * it.rate, shipment.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-gray-300 px-2 py-1.5" colSpan={4}>Total</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right">{totalPieces || "—"}</td>
              <td className="border border-gray-300 px-2 py-1.5"></td>
              <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(total, shipment.currency)}</td>
            </tr>
          </tfoot>
        </table>

        {(totalNet > 0 || shipment.grossWeight != null) && (
          <p className="mt-2 text-xs text-gray-700">
            {totalNet > 0 ? <>Net weight: <span className="font-medium">{totalNet} kg</span></> : null}
            {shipment.grossWeight != null ? <>{totalNet > 0 ? "  ·  " : ""}Gross weight: <span className="font-medium">{shipment.grossWeight} kg</span></> : null}
          </p>
        )}

        <div className="mt-6 flex items-start justify-between gap-6">
          <div className="text-xs">
            {bank.length > 0 && (
              <>
                <p className="mb-1 font-bold uppercase tracking-wide text-gray-500">Bank details ({shipment.currency})</p>
                <table className="border-collapse"><tbody>
                  {bank.map(([k, v]) => (<tr key={k}><td className="pr-3 align-top text-gray-500">{k}</td><td className="font-medium">{v}</td></tr>))}
                </tbody></table>
              </>
            )}
          </div>
          <div className="min-w-[200px] pt-2 text-center text-xs">
            <p className="mb-12 font-semibold">For {company.legalName || "us"}</p>
            <div className="border-t border-gray-400 pt-1">{company.signatureName || "Authorised Signatory"}</div>
          </div>
        </div>

        {shipment.notes && <p className="mt-4 text-xs text-gray-600"><span className="font-semibold">Notes:</span> {shipment.notes}</p>}
        {company.footerNote && <p className="mt-6 border-t border-gray-200 pt-3 text-center text-[11px] text-gray-500">{company.footerNote}</p>}
      </div>
    </div>
  );
}
