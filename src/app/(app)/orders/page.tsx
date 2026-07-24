import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Pager from "@/components/Pager";
import { CartIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";
import {
  formatMoney, formatDate, STAGE_LABELS, STAGE_COLORS, type OrderStage,
  fulfillmentOf, FULFILLMENT_LABELS, FULFILLMENT_COLORS,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type View = "active" | "done" | "all";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const view = (sp.view ?? "active") as View;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const PAGE_SIZE = 30;

  const all = await prisma.order.findMany({
    orderBy: { orderDate: "desc" },
    include: { customer: true, items: true },
  });

  // "Done" = fully shipped; "Active" = everything not fully shipped and not cancelled.
  const withFulfillment = all.map((o) => ({ o, f: fulfillmentOf(o.items) }));
  const orders = withFulfillment
    .filter(({ o, f }) =>
      view === "all" ? true
      : view === "done" ? f === "FULL"
      : f !== "FULL" && o.status !== "CANCELLED",
    )
    .map(({ o }) => o);

  const pagedOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tabs: [View, string][] = [["active", "Active"], ["done", "Done"], ["all", "All"]];

  const DAY = 86400000;
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  function dueChip(dueDate: Date | null, ful: string, status: string) {
    if (status === "CANCELLED" || ful === "FULL" || !dueDate) return null;
    const d = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
    if (d < today) return { label: "Overdue", cls: "bg-red-100 text-red-700" };
    if (d <= today + 7 * DAY) return { label: `Due ${formatDate(dueDate)}`, cls: "bg-amber-100 text-amber-700" };
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={all.length ? `${all.length} total` : undefined}
        action={
          <Link href="/orders/new" aria-label="New order" className="btn-primary !px-3 !py-2">
            <PlusIcon className="h-5 w-5" />
          </Link>
        }
      />

      {all.length === 0 ? (
        <EmptyState
          icon={<CartIcon className="h-8 w-8" />}
          title="No orders yet"
          message="Create your first sales order — pick a customer and add the products."
          actionLabel="Create your first order"
          actionHref="/orders/new"
        />
      ) : (
        <>
          <div className="flex gap-2 px-4 pt-2">
            {tabs.map(([value, label]) => (
              <Link key={value} href={value === "active" ? "/orders" : `/orders?view=${value}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${view === value ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-gray-50 text-gray-700 ring-gray-200"}`}>
                {label}
              </Link>
            ))}
          </div>

          {orders.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">
              {view === "done" ? "No fully-shipped orders yet." : "No orders here."}
            </p>
          ) : (
            <ul className="space-y-2 p-4">
              {pagedOrders.map((o) => {
                const total = o.items.reduce((s, i) => s + i.quantity * i.rate, 0);
                const f = fulfillmentOf(o.items);
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
                        <div className="flex flex-wrap justify-end gap-1">
                          {(() => { const dc = dueChip(o.dueDate, f, o.status); return dc ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dc.cls}`}>{dc.label}</span> : null; })()}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[o.status as OrderStage] ?? "bg-gray-100 text-gray-700"}`}>
                            {STAGE_LABELS[o.status as OrderStage] ?? o.status}
                          </span>
                          {o.status !== "CANCELLED" && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FULFILLMENT_COLORS[f]}`}>
                              {FULFILLMENT_LABELS[f]}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{formatMoney(total, o.currency)}</span>
                      </div>
                      <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Pager basePath="/orders" params={{ view: view === "active" ? undefined : view }} page={page} pageSize={PAGE_SIZE} total={orders.length} />
        </>
      )}
    </div>
  );
}
