import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import ExportButton from "./ExportButton";
import EmptyState from "@/components/EmptyState";
import CustomerFilters from "./CustomerFilters";
import Pager from "@/components/Pager";
import { formatDate } from "@/lib/format";
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
  const sort = sp.sort ?? "name";
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

  const PAGE_SIZE = 30;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const listInclude = {
    _count: { select: { orders: true } },
    orders: { orderBy: { orderDate: "desc" as const }, take: 1, select: { orderDate: true } },
  };

  // "Last order" needs each customer's latest order date, which the DB can't
  // orderBy directly — only that sort loads the matched set. Every other sort
  // (name / recent / most-orders) and all filters paginate in the database.
  let pagedCustomers: Prisma.CustomerGetPayload<{ include: typeof listInclude }>[];
  let matchCount: number;
  if (sort === "lastorder") {
    const rows = await prisma.customer.findMany({ where, include: listInclude });
    rows.sort((a, b) => (b.orders[0]?.orderDate?.getTime() ?? 0) - (a.orders[0]?.orderDate?.getTime() ?? 0));
    matchCount = rows.length;
    pagedCustomers = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      sort === "recent" ? { createdAt: "desc" } : sort === "orders" ? { orders: { _count: "desc" } } : { name: "asc" };
    [pagedCustomers, matchCount] = await Promise.all([
      prisma.customer.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: listInclude }),
      prisma.customer.count({ where }),
    ]);
  }

  // Filter options + the "any customers at all?" count — small, distinct queries
  // (not a full-table load).
  const [totalCustomers, countryRows, categoryRows, users] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.findMany({ where: { country: { not: null } }, select: { country: true }, distinct: ["country"], orderBy: { country: "asc" } }),
    prisma.customer.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  const countries = countryRows.map((c) => c.country).filter(Boolean) as string[];
  const categories = categoryRows.map((c) => c.category).filter(Boolean) as string[];
  const salespeople = users.map((u) => ({ id: u.id, label: u.name || u.email }));
  const filtersActive = !!(q || country || category || salesperson || showArchived);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={totalCustomers ? `${matchCount} shown` : undefined}
        action={
          <div className="flex items-center gap-2">
            {totalCustomers > 0 && <ExportButton />}
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
            sort={sort}
            showArchived={showArchived}
            countries={countries}
            categories={categories}
            salespeople={salespeople}
          />

          {matchCount === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">
              No customers match {filtersActive ? "these filters" : "your search"}.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 p-2">
              {pagedCustomers.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center gap-2 rounded-xl px-2 py-3 hover:bg-gray-50">
                    <Link href={`/customers/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
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
                          {c.orders[0] && ` · last ${formatDate(c.orders[0].orderDate)}`}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {c.currency}
                      </span>
                      {c.archived && <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-300" />}
                    </Link>
                    {!c.archived && (
                      <Link href={`/orders/new?customerId=${c.id}`} className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white active:bg-brand-700">
                        Order
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pager basePath="/customers" params={{ q, country, category, salesperson, sort, archived: showArchived ? "1" : undefined }} page={page} pageSize={PAGE_SIZE} total={matchCount} />
        </>
      )}
    </div>
  );
}
