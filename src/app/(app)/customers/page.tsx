import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { UsersIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { orders: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={customers.length ? `${customers.length} total` : undefined}
        action={
          <Link href="/customers/new" aria-label="Add customer" className="btn-primary !px-3 !py-2">
            <PlusIcon className="h-5 w-5" />
          </Link>
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8" />}
          title="No customers yet"
          message="Add the businesses you sell to. You'll pick them when creating orders."
          actionLabel="Add your first customer"
          actionHref="/customers/new"
        />
      ) : (
        <ul className="divide-y divide-gray-100 p-2">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-600">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{c.name}</p>
                  <p className="truncate text-sm text-gray-500">
                    {c.contactPerson || c.country || c.phone || "—"}
                    {c._count.orders > 0 && ` · ${c._count.orders} order${c._count.orders > 1 ? "s" : ""}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {c.currency}
                </span>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
