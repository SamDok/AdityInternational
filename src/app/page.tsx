import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UsersIcon, BoxIcon, CartIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";
import { formatMoney, formatDate, STATUS_LABELS, STATUS_COLORS, type OrderStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [customerCount, productCount, orders] = await Promise.all([
    prisma.customer.count(),
    prisma.product.count(),
    prisma.order.findMany({
      orderBy: { orderDate: "desc" },
      take: 5,
      include: { customer: true, items: true },
    }),
  ]);

  const openOrders = await prisma.order.count({
    where: { status: { in: ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "SHIPPED"] } },
  });

  return (
    <div className="p-4">
      <header className="mb-6 pt-4">
        <p className="text-sm font-medium text-gray-500">Welcome to</p>
        <h1 className="text-2xl font-bold text-gray-900">Aditya International</h1>
      </header>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Link href="/customers" className="card text-center">
          <UsersIcon className="mx-auto h-6 w-6 text-brand-500" />
          <p className="mt-2 text-2xl font-bold text-gray-900">{customerCount}</p>
          <p className="text-xs text-gray-500">Customers</p>
        </Link>
        <Link href="/products" className="card text-center">
          <BoxIcon className="mx-auto h-6 w-6 text-brand-500" />
          <p className="mt-2 text-2xl font-bold text-gray-900">{productCount}</p>
          <p className="text-xs text-gray-500">Products</p>
        </Link>
        <Link href="/orders" className="card text-center">
          <CartIcon className="mx-auto h-6 w-6 text-brand-500" />
          <p className="mt-2 text-2xl font-bold text-gray-900">{openOrders}</p>
          <p className="text-xs text-gray-500">Open orders</p>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link href="/customers/new" className="btn-primary">
          <PlusIcon className="h-5 w-5" /> Customer
        </Link>
        <Link href="/products/new" className="btn-secondary">
          <PlusIcon className="h-5 w-5" /> Product
        </Link>
      </div>

      {/* Recent orders */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-gray-500">Recent orders</h2>
          <Link href="/orders" className="text-sm font-medium text-brand-600">See all</Link>
        </div>
        {orders.length === 0 ? (
          <p className="card text-sm text-gray-500">No orders yet.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => {
              const total = o.items.reduce((s, i) => s + i.quantity * i.rate, 0);
              return (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">#{o.number} · {o.customer.name}</p>
                      <p className="text-sm text-gray-500">{formatDate(o.orderDate)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status as OrderStatus] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(total, o.currency)}</span>
                    <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
