import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import StatusPicker from "../StatusPicker";
import { formatMoney, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: { include: { design: true } } } },
    },
  });
  if (!order) notFound();

  const total = order.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const totalPieces = order.items.reduce((s, i) => s + (i.pieces ?? 0), 0);

  // Prefer the frozen snapshot; fall back to the live customer for older orders.
  const billToName = order.billToName || order.customer.company || order.customer.name;
  const billToAddress = order.billToAddress || order.customer.address;
  const shipToName = order.shipToName || null;
  const shipToAddress = order.shipToAddress || order.customer.shippingAddress;

  return (
    <div>
      <PageHeader
        title={`Order #${order.number}`}
        subtitle={order.customer.name}
        backHref="/orders"
        action={
          <Link href={`/orders/${order.id}/edit`} className="btn-secondary !px-4 !py-2 text-sm">
            Edit
          </Link>
        }
      />

      <div className="space-y-4 p-4">
        <div className="card">
          <p className="text-sm text-gray-500">Placed {formatDate(order.orderDate)}</p>
          {order.dueDate && <p className="text-sm text-gray-500">Due {formatDate(order.dueDate)}</p>}
          <p className="mt-1 text-sm text-gray-500">
            <Link href={`/customers/${order.customerId}`} className="font-medium text-brand-600 hover:underline">
              {order.customer.name}
            </Link>
          </p>
        </div>

        <StatusPicker orderId={order.id} current={order.status} />

        {/* Bill-to / ship-to snapshot (as it prints on the PDF) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bill to</p>
            <p className="mt-1 font-medium text-gray-900">{billToName}</p>
            {billToAddress && <p className="whitespace-pre-line text-sm text-gray-500">{billToAddress}</p>}
            {order.billToTaxId && <p className="mt-1 text-sm text-gray-500">GST/Tax: {order.billToTaxId}</p>}
          </div>
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ship to</p>
            {shipToName && <p className="mt-1 font-medium text-gray-900">{shipToName}</p>}
            {shipToAddress ? (
              <p className="whitespace-pre-line text-sm text-gray-500">{shipToAddress}</p>
            ) : (
              !shipToName && <p className="mt-1 text-sm text-gray-400">Same as bill-to</p>
            )}
            {order.destinationPort && <p className="mt-1 text-sm text-gray-500">Port: {order.destinationPort}</p>}
            {order.incoterms && <p className="text-sm text-gray-500">Incoterms: {order.incoterms}</p>}
          </div>
        </div>
        {order.paymentTerms && (
          <p className="px-1 text-sm text-gray-500">Payment terms: <span className="font-medium text-gray-700">{order.paymentTerms}</span></p>
        )}

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Items</h2>
          <ul className="space-y-2">
            {order.items.map((it) => (
              <li key={it.id} className="card">
                <div className="flex items-start gap-3">
                  {it.product.design?.imageData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.product.design.imageData} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-gray-100" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-[10px] text-gray-300 ring-1 ring-gray-100">No image</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">
                      {it.product.designId ? (
                        <Link href={`/products/design/${it.product.designId}`} className="hover:underline">
                          {it.product.name}
                        </Link>
                      ) : (
                        it.product.name
                      )}
                    </p>
                    {it.description && <p className="text-sm text-gray-500">{it.description}</p>}
                    <p className="mt-1 text-sm text-gray-500">
                      {it.quantity} {it.unit}
                      {it.pieces != null ? ` · ${it.pieces} pcs` : ""} × {formatMoney(it.rate, order.currency)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-gray-900">
                    {formatMoney(it.quantity * it.rate, order.currency)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="card flex items-center justify-between">
          <span className="text-base font-semibold text-gray-700">
            Total{totalPieces > 0 ? ` · ${totalPieces} pcs` : ""}
          </span>
          <span className="text-xl font-bold text-gray-900">{formatMoney(total, order.currency)}</span>
        </div>

        {order.notes && (
          <section className="card">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="mt-1 text-sm text-gray-900">{order.notes}</p>
          </section>
        )}
      </div>
    </div>
  );
}
