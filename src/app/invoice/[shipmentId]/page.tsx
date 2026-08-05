import { Fragment } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatDate, formatQty } from "@/lib/format";
import { shipmentDocNo } from "@/lib/jobNumber";
import { computeTax } from "@/lib/tax";
import { amountInWords } from "@/lib/words";
import { getCompanyProfile } from "../../(app)/settings/companyActions";
import DocPrintBar from "@/components/DocPrintBar";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ shipmentId: string }> }) {
  await requireUser();
  const { shipmentId } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      customer: true,
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: { include: { design: { include: { image: { select: { designId: true } } } } } },
          orderItem: { select: { order: { select: { number: true } } } },
        },
      },
    },
  });
  if (!shipment) notFound();

  const [company, bankAccount] = await Promise.all([
    getCompanyProfile(),
    prisma.bankAccount.findUnique({ where: { currency: shipment.currency } }),
  ]);

  const cancelled = shipment.status === "CANCELLED";
  const totalPieces = shipment.items.reduce((s, i) => s + (i.pieces ?? 0), 0);
  const totalNet = shipment.items.reduce((s, i) => s + i.netWeight, 0);

  // GST: per-line rate from the design (fallback to the company default). Exports
  // (non-INR) come back zero-rated with the LUT declaration.
  const tax = computeTax({
    currency: shipment.currency,
    sellerGstin: company.gstin,
    buyerGstin: shipment.billToTaxId,
    discountPct: shipment.discountPct,
    charges: (shipment.freight ?? 0) + (shipment.insurance ?? 0) + (shipment.otherCharges ?? 0),
    lines: shipment.items.map((i) => ({
      amount: i.quantity * i.rate,
      gstRate: i.product.design?.gstRate ?? company.defaultGstRate ?? 0,
    })),
  });
  const grandInWords = amountInWords(tax.grandTotal, shipment.currency);
  const hasTax = tax.tax > 0;
  const inrEquivalent = shipment.currency !== "INR" && shipment.fxRate ? tax.grandTotal * shipment.fxRate : null;

  // Logistics / compliance lines to print when present.
  const logistics = [
    ["Port of loading", shipment.portOfLoading],
    ["Vessel / flight", shipment.vessel],
    ["B/L or AWB no.", shipment.blAwbNo],
    ["Container no.", shipment.containerNo],
    ["Shipping bill no.", shipment.shippingBillNo],
    ["e-Invoice IRN", shipment.eInvoiceIrn],
    ["e-Way bill no.", shipment.ewayBillNo],
  ].filter(([, v]) => v) as [string, string][];

  // The customer orders this dispatch draws from, for the buyer to reconcile.
  const orderRefs = [...new Set(shipment.items.map((i) => i.orderItem?.order?.number).filter(Boolean))].sort(
    (a, b) => (a as number) - (b as number),
  );

  const originCountry = company.country || "India";
  const destCountry = shipment.destinationCountry;

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

      {cancelled && (
        <div className="mx-auto max-w-[820px] px-8 pt-6 print:px-0 print:pt-0">
          <p className="rounded border-2 border-red-600 bg-red-50 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-red-700">
            Cancelled — not a valid invoice
          </p>
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

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-700">
          {orderRefs.length > 0 && (
            <span><span className="text-gray-500">Buyer&apos;s order{orderRefs.length > 1 ? "s" : ""}:</span> {orderRefs.map((n) => `#${n}`).join(", ")}</span>
          )}
          <span><span className="text-gray-500">Country of origin:</span> {originCountry}</span>
          {destCountry && <span><span className="text-gray-500">Final destination:</span> {destCountry}</span>}
        </div>

        {logistics.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-gray-200 p-2 text-xs text-gray-700 sm:grid-cols-3">
            {logistics.map(([k, v]) => (
              <span key={k}><span className="text-gray-500">{k}:</span> {v}</span>
            ))}
          </div>
        )}

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
                    {it.product.design?.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/designs/${it.product.design.id}/image`} alt="" className="h-12 w-12 shrink-0 rounded bg-gray-50 object-contain ring-1 ring-gray-200" />
                    )}
                    <div>
                      <p className="font-medium">{it.product.name}</p>
                      {it.description && <p className="text-gray-600">{it.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center">{it.product.design?.hsnCode || "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatQty(it.quantity)} {it.unit}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{it.pieces ?? "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(it.rate, shipment.currency)}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(it.quantity * it.rate, shipment.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-gray-300 px-2 py-1.5" colSpan={4}>{tax.discount > 0 ? "Sub-total" : hasTax ? "Taxable value" : "Total"}</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right">{totalPieces || "—"}</td>
              <td className="border border-gray-300 px-2 py-1.5"></td>
              <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(tax.gross, shipment.currency)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-xs text-gray-700">
            {(totalNet > 0 || shipment.grossWeight != null) && (
              <p>
                {totalNet > 0 ? <>Net weight: <span className="font-medium">{formatQty(totalNet)} kg</span></> : null}
                {shipment.grossWeight != null ? <>{totalNet > 0 ? "  ·  " : ""}Gross weight: <span className="font-medium">{formatQty(shipment.grossWeight)} kg</span></> : null}
              </p>
            )}
            {tax.note && <p className="mt-1 font-medium text-gray-800">{tax.note}</p>}
          </div>

          <table className="min-w-[240px] border-collapse text-xs">
            <tbody>
              {tax.discount > 0 && (
                <>
                  <tr>
                    <td className="py-0.5 pr-4 text-gray-500">Sub-total</td>
                    <td className="py-0.5 text-right whitespace-nowrap">{formatMoney(tax.gross, shipment.currency)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-4 text-gray-500">Discount {formatQty(tax.discountPct)}%</td>
                    <td className="py-0.5 text-right whitespace-nowrap">− {formatMoney(tax.discount, shipment.currency)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td className="py-0.5 pr-4 text-gray-500">Taxable value</td>
                <td className="py-0.5 text-right whitespace-nowrap">{formatMoney(tax.taxable, shipment.currency)}</td>
              </tr>
              {tax.groups.map((g) =>
                g.igst > 0 ? (
                  <tr key={`i-${g.rate}`}>
                    <td className="py-0.5 pr-4 text-gray-500">IGST @ {formatQty(g.rate)}%</td>
                    <td className="py-0.5 text-right whitespace-nowrap">{formatMoney(g.igst, shipment.currency)}</td>
                  </tr>
                ) : g.cgst > 0 || g.sgst > 0 ? (
                  <Fragment key={`cs-${g.rate}`}>
                    <tr>
                      <td className="py-0.5 pr-4 text-gray-500">CGST @ {formatQty(g.rate / 2)}%</td>
                      <td className="py-0.5 text-right whitespace-nowrap">{formatMoney(g.cgst, shipment.currency)}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-4 text-gray-500">SGST @ {formatQty(g.rate / 2)}%</td>
                      <td className="py-0.5 text-right whitespace-nowrap">{formatMoney(g.sgst, shipment.currency)}</td>
                    </tr>
                  </Fragment>
                ) : null,
              )}
              {shipment.freight ? (
                <tr><td className="py-0.5 pr-4 text-gray-500">Freight</td><td className="py-0.5 text-right whitespace-nowrap">{formatMoney(shipment.freight, shipment.currency)}</td></tr>
              ) : null}
              {shipment.insurance ? (
                <tr><td className="py-0.5 pr-4 text-gray-500">Insurance</td><td className="py-0.5 text-right whitespace-nowrap">{formatMoney(shipment.insurance, shipment.currency)}</td></tr>
              ) : null}
              {shipment.otherCharges ? (
                <tr><td className="py-0.5 pr-4 text-gray-500">Other charges</td><td className="py-0.5 text-right whitespace-nowrap">{formatMoney(shipment.otherCharges, shipment.currency)}</td></tr>
              ) : null}
              <tr className="border-t border-gray-300 font-bold">
                <td className="py-1 pr-4">Grand total</td>
                <td className="py-1 text-right whitespace-nowrap">{formatMoney(tax.grandTotal, shipment.currency)}</td>
              </tr>
              {inrEquivalent != null && (
                <tr className="text-gray-500">
                  <td className="py-0.5 pr-4">INR equiv. @ {formatQty(shipment.fxRate!)}</td>
                  <td className="py-0.5 text-right whitespace-nowrap">{formatMoney(inrEquivalent, "INR")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-gray-700"><span className="font-semibold">Amount in words:</span> {grandInWords}</p>

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
