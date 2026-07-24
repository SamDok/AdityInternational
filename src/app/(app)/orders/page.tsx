import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Pager from "@/components/Pager";
import { CartIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";
import {
  formatMoney, formatDate, STAGE_LABELS, STAGE_COLORS, type OrderStage,
  orderComplete, orderBadge,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type View = "active" | "ready" | "done" | "all";

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
    include: { customer: true, items: { include: { product: { select: { stockQty: true } } } } },
  });

  // An order is "ready to ship" when it isn't complete and a not-fully-shipped
  // line has stock on hand.
  const isReadyToShip = (o: (typeof all)[number]) =>
    o.status !== "CANCELLED" && !orderComplete(o) &&
    o.items.some((i) => i.quantity - i.shippedQty > 1e-9 && i.product.stockQty > 1e-9);

  // "Done" = complete (fully shipped or hand-closed); "Active" = not complete and
  // not cancelled.
  const orders = all.filter((o) =>
    view === "all" ? true
    : view === "ready" ? isReadyToShip(o)
    : view === "done" ? orderComplete(o)
    : !orderComplete(o) && o.status !== "CANCELLED",
  );

  const readyCount = all.filter(isReadyToShip).length;
  const pagedOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tabs: [View, string][] = [["active", "Active"], ["ready", `Ready${readyCount ? ` (${readyCount})` : ""}`], ["done", "Done"], ["all", "All"]];

  const DAY = 86400000;
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  function dueChip(dueDate: Date | null, complete: boolean, status: string) {
    if (status === "CANCELLED" || complete || !dueDate) return null;
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
          <div className="flex gap-2 overflow-x-auto px-4 pt-2">
            {tabs.map(([value, label]) => (
              <Link key={value} href={value === "active" ? "/orders" : `/orders?view=${value}`}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${view === value ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-gray-50 text-gray-700 ring-gray-200"}`}>
                {label}
              </Link>
            ))}
          </div>

          {orders.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">
              {view === "done" ? "No completed orders yet."
                : view === "ready" ? "Nothing ready to ship — receive stock from jobs first."
                : "No orders here."}
            </p>
          ) : (
            <ul className="space-y-2 p-4">
              {pagedOrders.map((o) => {
                const total = o.items.reduce((s, i) => s + i.quantity * i.rate, 0);
                const fb = orderBadge(o);
                const ready = isReadyToShip(o);
                return (
                  <li key={o.id}>
                    <div className="card flex items-center gap-2">
                      <Link href={`/orders/${o.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="whitespace-nowrap font-semibold text-gray-900">Order #{o.number}</p>
                          <p className="truncate text-sm text-gray-500">
                            {o.customer.name} · {formatDate(o.orderDate)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex flex-wrap justify-end gap-1">
                            {(() => { const dc = dueChip(o.dueDate, orderComplete(o), o.status); return dc ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dc.cls}`}>{dc.label}</span> : null; })()}
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[o.status as OrderStage] ?? "bg-gray-100 text-gray-700"}`}>
                              {STAGE_LABELS[o.status as OrderStage] ?? o.status}
                            </span>
                            {o.status !== "CANCELLED" && (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${fb.className}`}>
                                {fb.label}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{formatMoney(total, o.currency)}</span>
                        </div>
                        {!ready && <ChevronRightIcon className="h-5 w-5 text-gray-300" />}
                      </Link>
                      {ready && (
                        <Link href={`/orders/${o.id}?ship=1`} className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white active:bg-green-700">
                          Ship
                        </Link>
                      )}
                    </div>
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
