import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { UsersIcon, BoxIcon, CartIcon, ChevronRightIcon, SearchIcon } from "@/components/Icons";
import { formatMoney, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim();
  const like = { contains: q, mode: "insensitive" as const };
  const asNumber = Number.parseInt(q, 10);

  const [customers, designs, orders] = q
    ? await Promise.all([
        prisma.customer.findMany({
          where: { OR: [{ name: like }, { company: like }, { code: like }, { email: like }] },
          take: 8,
          orderBy: { name: "asc" },
        }),
        prisma.design.findMany({
          where: { OR: [{ code: like }, { name: like }, { composition: like }] },
          take: 8,
          include: { category: true },
          orderBy: { code: "asc" },
        }),
        prisma.order.findMany({
          where: {
            OR: [
              ...(Number.isNaN(asNumber) ? [] : [{ number: asNumber } as Prisma.OrderWhereInput]),
              { customer: { name: like } },
            ],
          },
          take: 8,
          include: { customer: true, items: true },
          orderBy: { orderDate: "desc" },
        }),
      ])
    : [[], [], []];

  const total = customers.length + designs.length + orders.length;

  return (
    <div>
      <PageHeader title="Search" backHref="/" />

      <div className="p-4">
        <form action="/search" className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Search customers, designs, orders…"
            className="w-full rounded-xl border-0 bg-gray-50 py-3 pl-10 pr-4 text-base ring-1 ring-inset ring-gray-200 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </form>
      </div>

      {!q ? (
        <p className="px-6 py-12 text-center text-sm text-gray-500">Type a customer, design code, or order number.</p>
      ) : total === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-gray-500">Nothing found for “{q}”.</p>
      ) : (
        <div className="space-y-6 px-2 pb-8">
          {customers.length > 0 && (
            <Section title="Customers">
              {customers.map((c) => (
                <Row key={c.id} href={`/customers/${c.id}`} icon={<UsersIcon className="h-5 w-5" />} title={c.name} sub={[c.code, c.company, c.country].filter(Boolean).join(" · ")} />
              ))}
            </Section>
          )}
          {designs.length > 0 && (
            <Section title="Designs">
              {designs.map((d) => (
                <Row key={d.id} href={`/products/design/${d.id}`} icon={<BoxIcon className="h-5 w-5" />} title={`${d.code}${d.name ? ` · ${d.name}` : ""}`} sub={[d.category.name, d.composition].filter(Boolean).join(" · ")} />
              ))}
            </Section>
          )}
          {orders.length > 0 && (
            <Section title="Orders">
              {orders.map((o) => {
                const t = o.items.reduce((s, i) => s + i.quantity * i.rate, 0);
                return (
                  <Row key={o.id} href={`/orders/${o.id}`} icon={<CartIcon className="h-5 w-5" />} title={`Order #${o.number} · ${o.customer.name}`} sub={`${formatDate(o.orderDate)} · ${formatMoney(t, o.currency)}`} />
                );
              })}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 px-4 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
      <ul className="divide-y divide-gray-100">{children}</ul>
    </section>
  );
}

function Row({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{title}</p>
          {sub && <p className="truncate text-sm text-gray-500">{sub}</p>}
        </div>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-300" />
      </Link>
    </li>
  );
}
