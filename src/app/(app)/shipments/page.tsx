import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { formatDate, formatMoney } from "@/lib/format";
import { shipmentDocNo } from "@/lib/jobNumber";
import { CartIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  DISPATCHED: { label: "Dispatched", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function ShipmentsPage() {
  const shipments = await prisma.shipment.findMany({
    orderBy: { date: "desc" },
    include: { customer: { select: { name: true } }, items: { select: { quantity: true, rate: true, pieces: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Shipments"
        subtitle={shipments.length ? `${shipments.length} total` : undefined}
        backHref="/orders"
        action={<Link href="/shipments/new" aria-label="New shipment" className="btn-primary !px-3 !py-2"><PlusIcon className="h-5 w-5" /></Link>}
      />

      {shipments.length === 0 ? (
        <EmptyState
          icon={<CartIcon className="h-8 w-8" />}
          title="No shipments yet"
          message="Club a customer's ready orders into a dispatch, then print the invoice and packing list. Start from an order's Ship button or here."
          actionLabel="New shipment"
          actionHref="/shipments/new"
        />
      ) : (
        <ul className="space-y-2 p-4">
          {shipments.map((s) => {
            const value = s.items.reduce((a, i) => a + i.rate * i.quantity, 0);
            const badge = STATUS[s.status] ?? { label: s.status, cls: "bg-gray-100 text-gray-700" };
            return (
              <li key={s.id}>
                <Link href={`/shipments/${s.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{shipmentDocNo(s)} · {s.customer.name}</p>
                    <p className="truncate text-sm text-gray-500">{formatDate(s.date)} · {s.items.length} line{s.items.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(value, s.currency)}</span>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
