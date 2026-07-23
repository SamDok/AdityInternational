import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatDate } from "@/lib/format";
import { getCompanyProfile } from "../../(app)/settings/companyActions";
import PrintBar from "./PrintBar";

export const dynamic = "force-dynamic";

export default async function ProformaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: { include: { design: true } } } },
    },
  });
  if (!order) notFound();

  const [company, bankAccount] = await Promise.all([
    getCompanyProfile(),
    prisma.bankAccount.findUnique({ where: { currency: order.currency } }),
  ]);

  const total = order.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const totalPieces = order.items.reduce((s, i) => s + (i.pieces ?? 0), 0);

  const billToName = order.billToName || order.customer.company || order.customer.name;
  const billToAddress = order.billToAddress || order.customer.address;
  const shipToName = order.shipToName;
  const shipToAddress = order.shipToAddress;
  const hasShipTo = shipToName || shipToAddress || order.destinationPort || order.incoterms;

  // Bank block for the order's currency — print only the fields that are set.
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
      <PrintBar backHref={`/orders/${order.id}`} />

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
          <h1 className="text-lg font-bold uppercase tracking-wide">Proforma Invoice</h1>
          <div className="text-right text-xs">
            <p><span className="text-gray-500">No.:</span> <span className="font-semibold">PI-{order.number}</span></p>
            <p><span className="text-gray-500">Date:</span> {formatDate(order.orderDate)}</p>
            {order.dueDate && <p><span className="text-gray-500">Due:</span> {formatDate(order.dueDate)}</p>}
          </div>
        </div>

        {/* Parties */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Bill To</p>
            <p className="font-semibold">{billToName}</p>
            {billToAddress && <p className="whitespace-pre-line text-xs text-gray-700">{billToAddress}</p>}
            {order.billToTaxId && <p className="mt-1 text-xs text-gray-700">GST/Tax ID: {order.billToTaxId}</p>}
          </div>
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Ship To</p>
            {hasShipTo ? (
              <>
                {shipToName && <p className="font-semibold">{shipToName}</p>}
                {shipToAddress && <p className="whitespace-pre-line text-xs text-gray-700">{shipToAddress}</p>}
                {order.destinationPort && <p className="mt-1 text-xs text-gray-700">Port of discharge: {order.destinationPort}</p>}
                {order.incoterms && <p className="text-xs text-gray-700">Incoterms: {order.incoterms}</p>}
              </>
            ) : (
              <p className="text-xs text-gray-500">Same as Bill To</p>
            )}
          </div>
        </div>

        {order.paymentTerms && (
          <p className="mt-3 text-xs"><span className="font-semibold">Payment terms:</span> {order.paymentTerms}</p>
        )}

        {/* Items */}
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
            {order.items.map((it, i) => (
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
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">
                  {it.quantity} {it.unit}
                  {it.pieces && it.perPieceQty != null && (
                    <span className="block text-[10px] text-gray-500">{it.pieces} × {it.perPieceQty}</span>
                  )}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{it.pieces ?? "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(it.rate, order.currency)}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(it.quantity * it.rate, order.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-gray-300 px-2 py-1.5" colSpan={4}>Total</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right">{totalPieces || "—"}</td>
              <td className="border border-gray-300 px-2 py-1.5"></td>
              <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatMoney(total, order.currency)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Bank + signature */}
        <div className="mt-6 flex items-start justify-between gap-6">
          <div className="text-xs">
            {bank.length > 0 && (
              <>
                <p className="mb-1 font-bold uppercase tracking-wide text-gray-500">Bank details ({order.currency})</p>
                <table className="border-collapse">
                  <tbody>
                    {bank.map(([k, v]) => (
                      <tr key={k}>
                        <td className="pr-3 align-top text-gray-500">{k}</td>
                        <td className="font-medium">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
          <div className="min-w-[200px] pt-2 text-center text-xs">
            <p className="mb-12 font-semibold">For {company.legalName || "us"}</p>
            <div className="border-t border-gray-400 pt-1">{company.signatureName || "Authorised Signatory"}</div>
          </div>
        </div>

        {order.notes && (
          <p className="mt-4 text-xs text-gray-600"><span className="font-semibold">Notes:</span> {order.notes}</p>
        )}
        {company.footerNote && (
          <p className="mt-6 border-t border-gray-200 pt-3 text-center text-[11px] text-gray-500">{company.footerNote}</p>
        )}
      </div>
    </div>
  );
}
