import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import CustomerFilters from "./CustomerFilters";
import { UsersIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const country = sp.country ?? "";
  const category = sp.category ?? "";
  const salesperson = sp.salesperson ?? "";
  const showArchived = sp.archived === "1";

  const where: Prisma.CustomerWhereInput = {
    ...(showArchived ? {} : { archived: false }),
    ...(country ? { country } : {}),
    ...(category ? { category } : {}),
    ...(salesperson ? { salespersonId: salesperson } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
            { contactPerson: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [customers, allForOptions, users] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { orders: true } } },
    }),
    prisma.customer.findMany({ select: { country: true, category: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  const totalCustomers = allForOptions.length;
  const countries = [...new Set(allForOptions.map((c) => c.country).filter(Boolean))].sort() as string[];
  const categories = [...new Set(allForOptions.map((c) => c.category).filter(Boolean))].sort() as string[];
  const salespeople = users.map((u) => ({ id: u.id, label: u.name || u.email }));
  const filtersActive = !!(q || country || category || salesperson || showArchived);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={totalCustomers ? `${customers.length} shown` : undefined}
        action={
          <div className="flex items-center gap-2">
            <Link href="/customers/import" className="btn-secondary !px-3 !py-2 text-sm">
              Import
            </Link>
            <Link href="/customers/new" aria-label="Add customer" className="btn-primary !px-3 !py-2">
              <PlusIcon className="h-5 w-5" />
            </Link>
          </div>
        }
      />

      {totalCustomers === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8" />}
          title="No customers yet"
          message="Add the businesses you sell to. You'll pick them when creating orders."
          actionLabel="Add your first customer"
          actionHref="/customers/new"
        />
      ) : (
        <>
          <CustomerFilters
            q={q}
            country={country}
            category={category}
            salesperson={salesperson}
            showArchived={showArchived}
            countries={countries}
            categories={categories}
            salespeople={salespeople}
          />

          {customers.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">
              No customers match {filtersActive ? "these filters" : "your search"}.
            </p>
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
                      <p className="flex items-center gap-2 truncate font-semibold text-gray-900">
                        {c.name}
                        {c.archived && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Archived
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-gray-500">
                        {[c.code, c.contactPerson || c.country || c.phone].filter(Boolean).join(" · ") || "—"}
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
        </>
      )}
    </div>
  );
}
