import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { procurementBoard } from "../orders/procurement";
import GenerateProcurement from "../orders/GenerateProcurement";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; customer?: string; overdue?: string }>;
}) {
  const sp = await searchParams;
  const vendor = sp.vendor ?? "";
  const customer = sp.customer ?? "";
  const overdue = sp.overdue === "1";

  const board = await procurementBoard();

  // Apply filters (in memory — the board itself is already a few bulk queries).
  let needs = board.needs;
  if (customer) needs = needs.filter((n) => n.customerId === customer);
  if (vendor) {
    needs = needs
      .filter((n) => n.vendorIds.includes(vendor))
      .map((n) => ({ ...n, groups: n.groups.filter((g) => g.vendorId === vendor), unassignedCount: 0 }));
  }

  let awaiting = board.awaiting;
  if (vendor) awaiting = awaiting.filter((a) => a.vendorId === vendor);
  if (overdue) {
    awaiting = awaiting
      .map((a) => ({ ...a, items: a.items.filter((i) => i.overdue) }))
      .filter((a) => a.items.length > 0);
  }

  // Build a filter href preserving the other params, toggling one key.
  const chip = (key: "vendor" | "customer" | "overdue", value: string) => {
    const next = { vendor, customer, overdue: overdue ? "1" : "" };
    (next as Record<string, string>)[key] = (next as Record<string, string>)[key] === value ? "" : value;
    const qs = new URLSearchParams();
    if (next.vendor) qs.set("vendor", next.vendor);
    if (next.customer) qs.set("customer", next.customer);
    if (next.overdue) qs.set("overdue", "1");
    const s = qs.toString();
    return s ? `/procurement?${s}` : "/procurement";
  };
  const chipCls = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${active ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-gray-50 text-gray-700 ring-gray-200"}`;

  return (
    <div>
      <PageHeader title="Procurement" subtitle="What to make/buy, and what's on its way" backHref="/more" />

      <div className="space-y-5 p-4">
        {/* Filters */}
        {(board.vendorOpts.length > 0 || board.customerOpts.length > 0) && (
          <div className="space-y-2">
            {board.vendorOpts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Link href={chip("vendor", "")} className={chipCls(!vendor)}>All vendors</Link>
                {board.vendorOpts.map((v) => (
                  <Link key={v.id} href={chip("vendor", v.id)} className={chipCls(vendor === v.id)}>{v.name}</Link>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href={chip("overdue", "1")} className={chipCls(overdue)}>Overdue only</Link>
              {board.customerOpts.map((c) => (
                <Link key={c.id} href={chip("customer", c.id)} className={chipCls(customer === c.id)}>{c.name}</Link>
              ))}
            </div>
          </div>
        )}

        {/* Still to procure */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">
            Still to procure {needs.length > 0 && <span className="text-gray-400">· {needs.length}</span>}
          </h2>
          {needs.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Nothing waiting — covered by stock or already issued.</p>
          ) : (
            <ul className="space-y-2">
              {needs.map((n) => (
                <li key={n.orderId} className="card space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/orders/${n.orderId}`} className="font-semibold text-brand-600 hover:underline">Order #{n.number} · {n.customerName}</Link>
                    {n.dueDate && <span className="shrink-0 text-xs text-gray-400">due {formatDate(n.dueDate)}</span>}
                  </div>
                  {n.groups.map((g) => (
                    <div key={g.vendorId + g.kind} className="rounded-lg bg-gray-50 p-2 text-xs">
                      <span className="font-semibold text-gray-900">{g.vendorName}</span>
                      <span className="text-gray-400"> · {g.kind === "JOB_WORK" ? "Job work" : "Purchase"}</span>
                      <ul className="mt-0.5">
                        {g.lines.map((l) => (
                          <li key={l.productId} className="text-gray-600">{l.name} — <span className="font-medium text-gray-800">{l.shortfall} {l.unit}</span></li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {n.unassignedCount > 0 && (
                    <p className="text-xs text-amber-600">{n.unassignedCount} line{n.unassignedCount > 1 ? "s" : ""} need a kaarigar/supplier set on the design first.</p>
                  )}
                  {n.groups.length > 0 && <GenerateProcurement orderId={n.orderId} label="Generate jobs & purchase orders" />}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Awaiting, grouped by vendor */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">
            Awaiting from kaarigars &amp; suppliers {awaiting.length > 0 && <span className="text-gray-400">· {awaiting.length}</span>}
          </h2>
          {awaiting.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Nothing out for making or purchase right now.</p>
          ) : (
            <ul className="space-y-2">
              {awaiting.map((a) => (
                <li key={a.vendorId} className="card">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Link href={`/vendors/${a.vendorId}`} className="font-semibold text-gray-900 hover:underline">{a.vendorName}</Link>
                    {a.anyOverdue && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>}
                  </div>
                  <ul className="space-y-0.5">
                    {a.items.map((i, idx) => (
                      <li key={a.vendorId + idx} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-gray-600">
                          {i.productName} — <span className="font-medium text-gray-800">{i.outstanding} {i.unit} left</span>
                        </span>
                        <span className="shrink-0 text-gray-400">
                          <Link href={`/jobs/${i.jobId}`} className="text-brand-600">#{i.jobNumber}</Link>
                          {i.orderNumber ? ` · ord #${i.orderNumber}` : ""}
                          {i.dueDate ? ` · ${i.overdue ? "overdue " : "due "}${formatDate(i.dueDate)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* By-design rollup — true aggregate net demand */}
        {board.rollup.length > 0 && (
          <details className="card">
            <summary className="cursor-pointer font-semibold text-gray-900">
              By design — total still to make/buy
              <span className="ml-1 text-xs font-normal text-gray-400">· {board.rollup.length}</span>
            </summary>
            <ul className="mt-3 divide-y divide-gray-100">
              {board.rollup.map((r) => (
                <li key={r.productId} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate text-gray-700">{r.name}</span>
                  <span className="shrink-0 text-gray-500">
                    <span className="font-semibold text-gray-900">{Math.round(r.toProcure * 100) / 100} {r.unit}</span>
                    <span className="text-xs text-gray-400"> (need {r.demand}, {r.stock} stock, {r.onOrder} on order)</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
