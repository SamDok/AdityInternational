import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { CartIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";
import { formatMoney, formatDate, STATUS_LABELS, STATUS_COLORS, type OrderStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { orderDate: "desc" },
    include: { customer: true, items: true },
  });

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={orders.length ? `${orders.length} total` : undefined}
        action={
          <Link href="/orders/new" aria-label="New order" className="btn-primary !px-3 !py-2">
            <PlusIcon className="h-5 w-5" />
          </Link>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<CartIcon className="h-8 w-8" />}
          title="No orders yet"
          message="Create your first sales order — pick a customer and add the products."
          actionLabel="Create your first order"
          actionHref="/orders/new"
        />
      ) : (
        <ul className="space-y-2 p-4">
          {orders.map((o) => {
            const total = o.items.reduce((s, i) => s + i.quantity * i.rate, 0);
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">Order #{o.number}</p>
                    <p className="truncate text-sm text-gray-500">
                      {o.customer.name} · {formatDate(o.orderDate)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status as OrderStatus] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(total, o.currency)}</span>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
