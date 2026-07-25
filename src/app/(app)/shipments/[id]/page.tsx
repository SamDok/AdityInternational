import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatDate, formatMoney } from "@/lib/format";
import { shipmentDocNo } from "@/lib/jobNumber";
import ToggleButton from "../../products/ToggleButton";
import { cancelShipment } from "../actions";

export const dynamic = "force-dynamic";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { orderItem: { select: { order: { select: { id: true, number: true } } } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!shipment) notFound();

  const cancelled = shipment.status === "CANCELLED";
  const value = shipment.items.reduce((a, i) => a + i.rate * i.quantity, 0);
  const totalPieces = shipment.items.reduce((a, i) => a + (i.pieces ?? 0), 0);
  const totalMetres = shipment.items.reduce((a, i) => a + i.quantity, 0);
  const totalNet = shipment.items.reduce((a, i) => a + i.netWeight, 0);

  // Group by the order each line came from.
  const groups = new Map<number, { orderId: string; items: typeof shipment.items }>();
  for (const it of shipment.items) {
    const num = it.orderItem.order.number;
    if (!groups.has(num)) groups.set(num, { orderId: it.orderItem.order.id, items: [] as typeof shipment.items });
    groups.get(num)!.items.push(it);
  }
  const orderGroups = [...groups.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div>
      <PageHeader
        title={shipmentDocNo(shipment)}
        subtitle={shipment.customer.name}
        backHref="/shipments"
        action={
          <div className="flex gap-2">
            <Link href={`/invoice/${shipment.id}`} className="btn-secondary !px-3 !py-2 text-sm">Invoice</Link>
            <Link href={`/packing/${shipment.id}`} className="btn-secondary !px-3 !py-2 text-sm">Packing</Link>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        {cancelled && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-800">This shipment is cancelled — stock was returned.</div>}

        <div className="card">
          <p className="text-sm text-gray-500">Shipped {formatDate(shipment.date)}</p>
          {shipment.destinationPort && <p className="text-sm text-gray-500">Port: {shipment.destinationPort}{shipment.incoterms ? ` · ${shipment.incoterms}` : ""}</p>}
          {shipment.marksNumbers && <p className="text-sm text-gray-500">Marks: {shipment.marksNumbers}</p>}
          {shipment.createdByName && <p className="text-xs text-gray-400">By {shipment.createdByName}</p>}
        </div>

        {orderGroups.map(([number, g]) => (
          <section key={number}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">
              From <Link href={`/orders/${g.orderId}`} className="text-brand-600 hover:underline">order #{number}</Link>
            </h2>
            <ul className="space-y-2">
              {g.items.map((it) => (
                <li key={it.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{it.description ? `${it.description}` : ""}</p>
                      <p className="text-sm text-gray-900">{it.quantity} {it.unit}{it.pieces ? ` · ${it.pieces} pcs` : ""}{it.netWeight ? ` · ${it.netWeight} kg` : ""}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{formatMoney(it.rate, shipment.currency)}/{it.unit}</p>
                    </div>
                    <p className="shrink-0 font-semibold text-gray-900">{formatMoney(it.rate * it.quantity, shipment.currency)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="card space-y-1">
          <div className="flex items-center justify-between"><span className="text-sm text-gray-500">Total metres</span><span className="font-medium text-gray-900">{totalMetres}</span></div>
          {totalPieces > 0 && <div className="flex items-center justify-between"><span className="text-sm text-gray-500">Total pieces</span><span className="font-medium text-gray-900">{totalPieces}</span></div>}
          {totalNet > 0 && <div className="flex items-center justify-between"><span className="text-sm text-gray-500">Net weight</span><span className="font-medium text-gray-900">{totalNet} kg</span></div>}
          {shipment.grossWeight != null && <div className="flex items-center justify-between"><span className="text-sm text-gray-500">Gross weight</span><span className="font-medium text-gray-900">{shipment.grossWeight} kg</span></div>}
          <div className="flex items-center justify-between border-t border-gray-100 pt-1"><span className="text-base font-semibold text-gray-700">Invoice value</span><span className="text-xl font-bold text-gray-900">{formatMoney(value, shipment.currency)}</span></div>
        </div>

        {shipment.notes && (
          <section className="card"><p className="text-sm text-gray-500">Notes</p><p className="mt-1 text-sm text-gray-900">{shipment.notes}</p></section>
        )}

        {!cancelled && (
          <ToggleButton
            action={cancelShipment.bind(null, shipment.id)}
            label="Cancel shipment (return stock)"
            toastMessage="Shipment cancelled — stock returned"
          />
        )}
      </div>
    </div>
  );
}
