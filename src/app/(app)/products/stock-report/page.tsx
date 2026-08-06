import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatQty } from "@/lib/format";

export const dynamic = "force-dynamic";

// Start of the current Indian financial year (1 April), as a default "from".
function fyStart(now = new Date()): Date {
  const y = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, 3, 1));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function StockReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date();
  const from = sp.from ? new Date(sp.from + "T00:00:00.000Z") : fyStart(today);
  const to = sp.to ? new Date(sp.to + "T00:00:00.000Z") : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const toExclusive = new Date(to.getTime() + 86400000); // include the whole "to" day

  // Movements inside the window: these are the variants worth listing, plus the
  // received / issued totals for each.
  const inRange = await prisma.stockMovement.findMany({
    where: { createdAt: { gte: from, lt: toExclusive } },
    select: { productId: true, delta: true },
  });

  // Reverse-engineer opening/closing from the live stock: closing = live minus
  // everything that happened after the window; opening = live minus everything
  // from the window start onward.
  const [afterWindow, fromWindowOnward] = await Promise.all([
    prisma.stockMovement.groupBy({ by: ["productId"], where: { createdAt: { gte: toExclusive } }, _sum: { delta: true } }),
    prisma.stockMovement.groupBy({ by: ["productId"], where: { createdAt: { gte: from } }, _sum: { delta: true } }),
  ]);
  const afterSum = new Map(afterWindow.map((r) => [r.productId, r._sum.delta ?? 0]));
  const onwardSum = new Map(fromWindowOnward.map((r) => [r.productId, r._sum.delta ?? 0]));

  // Per-variant received (in) and issued (out) within the window.
  const received = new Map<string, number>();
  const issued = new Map<string, number>();
  for (const m of inRange) {
    if (m.delta > 0) received.set(m.productId, (received.get(m.productId) ?? 0) + m.delta);
    else if (m.delta < 0) issued.set(m.productId, (issued.get(m.productId) ?? 0) - m.delta);
  }

  const productIds = [...new Set(inRange.map((m) => m.productId))];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, unit: true, stockQty: true, designId: true },
      })
    : [];

  const rows = products
    .map((p) => {
      const closing = p.stockQty - (afterSum.get(p.id) ?? 0);
      const opening = p.stockQty - (onwardSum.get(p.id) ?? 0);
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        designId: p.designId,
        opening,
        received: received.get(p.id) ?? 0,
        issued: issued.get(p.id) ?? 0,
        closing,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const inputClass = "rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-800 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none";

  return (
    <div>
      <PageHeader title="Stock report" subtitle="Opening / received / issued / closing by variant" backHref="/products/movements" />

      <form method="get" className="flex flex-wrap items-end gap-3 px-4 pt-3">
        <div>
          <label className="field-label" htmlFor="from">From</label>
          <input type="date" id="from" name="from" defaultValue={isoDay(from)} className={inputClass} />
        </div>
        <div>
          <label className="field-label" htmlFor="to">To</label>
          <input type="date" id="to" name="to" defaultValue={isoDay(to)} className={inputClass} />
        </div>
        <button type="submit" className="btn-primary !py-2 text-sm">Apply</button>
      </form>

      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-gray-500">No stock movements in this period.</p>
      ) : (
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-3">Variant</th>
                <th className="py-2 px-2 text-right">Opening</th>
                <th className="py-2 px-2 text-right text-green-700">Received</th>
                <th className="py-2 px-2 text-right text-red-700">Issued</th>
                <th className="py-2 pl-2 text-right">Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3">
                    {r.designId ? (
                      <Link href={`/products/design/${r.designId}`} className="font-medium text-gray-900 hover:underline">{r.name}</Link>
                    ) : (
                      <span className="font-medium text-gray-900">{r.name}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-700">{formatQty(r.opening)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-green-700">{r.received ? `+${formatQty(r.received)}` : "—"}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-red-700">{r.issued ? `−${formatQty(r.issued)}` : "—"}</td>
                  <td className="py-2 pl-2 text-right font-semibold tabular-nums text-gray-900">{formatQty(r.closing)} <span className="text-xs font-normal text-gray-400">{r.unit}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
