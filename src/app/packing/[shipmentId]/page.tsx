import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDate, formatQty } from "@/lib/format";
import { shipmentDocNo } from "@/lib/jobNumber";
import { getCompanyProfile } from "../../(app)/settings/companyActions";
import DocPrintBar from "@/components/DocPrintBar";

export const dynamic = "force-dynamic";

export default async function PackingListPage({ params }: { params: Promise<{ shipmentId: string }> }) {
  await requireUser();
  const { shipmentId } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { customer: true, items: { orderBy: { createdAt: "asc" }, include: { product: { include: { design: true } } } } },
  });
  if (!shipment) notFound();

  const company = await getCompanyProfile();

  const totalPieces = shipment.items.reduce((s, i) => s + (i.pieces ?? 0), 0);
  const totalMetres = shipment.items.reduce((s, i) => s + i.quantity, 0);
  const totalNet = shipment.items.reduce((s, i) => s + i.netWeight, 0);
  const totalCartons = shipment.items.reduce((s, i) => s + (i.cartons ?? 0), 0);

  const shipToName = shipment.shipToName || shipment.billToName || shipment.customer.company || shipment.customer.name;
  const shipToAddress = shipment.shipToAddress || shipment.billToAddress || shipment.customer.address;
  const cancelled = shipment.status === "CANCELLED";

  return (
    <div className="min-h-screen bg-gray-100">
      <DocPrintBar backHref={`/shipments/${shipment.id}`} backLabel="Back to shipment" />

      {cancelled && (
        <div className="mx-auto max-w-[820px] px-8 pt-6 print:px-0 print:pt-0">
          <p className="rounded border-2 border-red-600 bg-red-50 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-red-700">
            Cancelled — not a valid packing list
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
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wide">Packing List</h1>
          <div className="text-right text-xs">
            <p><span className="text-gray-500">No.:</span> <span className="font-semibold">{shipmentDocNo(shipment, "PL")}</span></p>
            <p><span className="text-gray-500">Date:</span> {formatDate(shipment.date)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Consignee</p>
            <p className="font-semibold">{shipToName}</p>
            {shipToAddress && <p className="whitespace-pre-line text-xs text-gray-700">{shipToAddress}</p>}
            {shipment.destinationPort && <p className="mt-1 text-xs text-gray-700">Port of discharge: {shipment.destinationPort}</p>}
          </div>
          <div className="rounded border border-gray-200 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Marks &amp; Numbers</p>
            <p className="whitespace-pre-line text-xs text-gray-700">{shipment.marksNumbers || "—"}</p>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border border-gray-300 px-2 py-1.5 text-center">#</th>
              <th className="border border-gray-300 px-2 py-1.5">Description</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Pcs</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Qty</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Net wt</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Cartons</th>
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
                <td className="border border-gray-300 px-2 py-1.5 text-right">{it.pieces ?? "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatQty(it.quantity)} {it.unit}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{it.netWeight ? `${formatQty(it.netWeight)} kg` : "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{it.cartons ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-gray-300 px-2 py-1.5" colSpan={2}>Total</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right">{totalPieces || "—"}</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatQty(totalMetres)}</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{totalNet ? `${formatQty(totalNet)} kg` : "—"}</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right">{totalCartons || "—"}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-4 flex items-start justify-between gap-6 text-xs">
          <div className="text-gray-700">
            <p><span className="text-gray-500">Total pieces:</span> <span className="font-medium">{totalPieces || "—"}</span></p>
            <p><span className="text-gray-500">Net weight:</span> <span className="font-medium">{totalNet ? `${formatQty(totalNet)} kg` : "—"}</span></p>
            <p><span className="text-gray-500">Gross weight:</span> <span className="font-medium">{shipment.grossWeight != null ? `${formatQty(shipment.grossWeight)} kg` : "—"}</span></p>
            <p><span className="text-gray-500">Total cartons:</span> <span className="font-medium">{totalCartons || "—"}</span></p>
          </div>
          <div className="min-w-[200px] pt-2 text-center">
            <p className="mb-12 font-semibold">For {company.legalName || "us"}</p>
            <div className="border-t border-gray-400 pt-1">{company.signatureName || "Authorised Signatory"}</div>
          </div>
        </div>

        {company.footerNote && <p className="mt-6 border-t border-gray-200 pt-3 text-center text-[11px] text-gray-500">{company.footerNote}</p>}
      </div>
    </div>
  );
}
