import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { ChevronRightIcon, DocumentIcon } from "@/components/Icons";
import { formatMoney } from "@/lib/format";
import { getCompanyProfile } from "../settings/companyActions";
import { shipmentGrandTotal, jobReceivedValue, sumByCurrency, balances, type Balance } from "@/lib/money";

export const dynamic = "force-dynamic";

function outstandingLine(bs: Balance[]) {
  const owed = bs.filter((b) => b.outstanding > 0.01);
  return owed.map((b) => formatMoney(b.outstanding, b.currency)).join(" · ");
}

// Roll per-currency outstanding across many parties into one total per currency.
function grandOutstanding(all: Balance[][]): Map<string, number> {
  const rows: { amount: number; currency: string }[] = [];
  for (const bs of all) for (const b of bs) if (b.outstanding > 0.01) rows.push({ amount: b.outstanding, currency: b.currency });
  return sumByCurrency(rows);
}

export default async function MoneyPage() {
  const company = await getCompanyProfile();

  const [customers, vendors] = await Promise.all([
    prisma.customer.findMany({
      where: { archived: false },
      select: {
        id: true, name: true, company: true,
        shipments: {
          where: { status: { not: "CANCELLED" } },
          select: { currency: true, status: true, billToTaxId: true, items: { select: { quantity: true, rate: true, product: { select: { design: { select: { gstRate: true } } } } } } },
        },
        payments: { select: { amount: true, currency: true } },
      },
    }),
    prisma.vendor.findMany({
      where: { archived: false },
      select: {
        id: true, name: true, kind: true,
        jobs: { where: { status: { not: "CANCELLED" } }, select: { currency: true, items: { select: { qtyReceived: true, rate: true } } } },
        payments: { select: { amount: true, currency: true } },
      },
    }),
  ]);

  const receivables = customers
    .map((c) => {
      const billed = sumByCurrency(c.shipments.map((s) => ({ amount: shipmentGrandTotal(s, company), currency: s.currency })));
      const paid = sumByCurrency(c.payments);
      return { id: c.id, name: c.company || c.name, bs: balances(billed, paid) };
    })
    .filter((r) => r.bs.some((b) => b.outstanding > 0.01))
    .sort((a, b) => Math.max(...a.bs.map((x) => x.outstanding), 0) < Math.max(...b.bs.map((x) => x.outstanding), 0) ? 1 : -1);

  const payables = vendors
    .map((v) => {
      const billed = sumByCurrency(v.jobs.map((j) => ({ amount: jobReceivedValue(j), currency: j.currency })));
      const paid = sumByCurrency(v.payments);
      return { id: v.id, name: v.name, bs: balances(billed, paid) };
    })
    .filter((r) => r.bs.some((b) => b.outstanding > 0.01))
    .sort((a, b) => Math.max(...a.bs.map((x) => x.outstanding), 0) < Math.max(...b.bs.map((x) => x.outstanding), 0) ? 1 : -1);

  const totalIn = grandOutstanding(receivables.map((r) => r.bs));
  const totalOut = grandOutstanding(payables.map((r) => r.bs));

  return (
    <div>
      <PageHeader title="Money" subtitle="Who owes us, and who we owe" backHref="/more" />

      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">To receive</p>
          <p className="mt-1 text-lg font-bold text-green-700">
            {totalIn.size ? [...totalIn].map(([c, a]) => formatMoney(a, c)).join(" · ") : "—"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">To pay</p>
          <p className="mt-1 text-lg font-bold text-red-700">
            {totalOut.size ? [...totalOut].map(([c, a]) => formatMoney(a, c)).join(" · ") : "—"}
          </p>
        </div>
      </div>

      <section className="px-2">
        <h2 className="px-2 pb-1 pt-2 text-sm font-semibold text-gray-500">Receivables</h2>
        {receivables.length === 0 ? (
          <EmptyState icon={<DocumentIcon className="h-8 w-8" />} title="Nothing outstanding" message="Every customer is settled up." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {receivables.map((r) => (
              <li key={r.id}>
                <Link href={`/customers/${r.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{r.name}</p>
                  </div>
                  <span className="shrink-0 text-right text-sm font-semibold text-green-700">{outstandingLine(r.bs)}</span>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 px-2 pb-8">
        <h2 className="px-2 pb-1 pt-2 text-sm font-semibold text-gray-500">Payables</h2>
        {payables.length === 0 ? (
          <EmptyState icon={<DocumentIcon className="h-8 w-8" />} title="Nothing to pay" message="Every vendor is settled up." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {payables.map((r) => (
              <li key={r.id}>
                <Link href={`/vendors/${r.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{r.name}</p>
                  </div>
                  <span className="shrink-0 text-right text-sm font-semibold text-red-700">{outstandingLine(r.bs)}</span>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
