import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney, formatDate, STATUS_LABELS, STATUS_COLORS, type OrderStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } } },
  });
  if (!order) notFound();

  const total = order.items.reduce((s, i) => s + i.quantity * i.rate, 0);

  return (
    <div>
      <PageHeader title={`Order #${order.number}`} subtitle={order.customer.name} backHref="/orders" />

      <div className="space-y-4 p-4">
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Placed {formatDate(order.orderDate)}</p>
            {order.dueDate && <p className="text-sm text-gray-500">Due {formatDate(order.dueDate)}</p>}
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[order.status as OrderStatus] ?? "bg-gray-100 text-gray-700"}`}>
            {STATUS_LABELS[order.status as OrderStatus] ?? order.status}
          </span>
        </div>

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Items</h2>
          <ul className="space-y-2">
            {order.items.map((it) => (
              <li key={it.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      <Link href={`/products/${it.productId}`} className="hover:underline">
                        {it.product.name}
                      </Link>
                    </p>
                    {it.description && <p className="text-sm text-gray-500">{it.description}</p>}
                    <p className="mt-1 text-sm text-gray-500">
                      {it.quantity} {it.unit} × {formatMoney(it.rate, order.currency)}
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
          <span className="text-base font-semibold text-gray-700">Total</span>
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
