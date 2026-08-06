import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { formatDate, formatMoney } from "@/lib/format";
import { materialPoDocNo } from "@/lib/jobNumber";
import { DocumentIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-blue-100 text-blue-700" },
  PARTIAL: { label: "Partial", cls: "bg-amber-100 text-amber-700" },
  RECEIVED: { label: "Received", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function MaterialOrdersPage() {
  const pos = await prisma.materialPurchaseOrder.findMany({
    orderBy: { issueDate: "desc" },
    take: 100,
    include: { vendor: { select: { name: true } }, items: { select: { qtyOrdered: true, rate: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Material POs"
        subtitle={pos.length ? `${pos.length} order${pos.length === 1 ? "" : "s"}` : undefined}
        backHref="/materials"
        action={<Link href="/material-orders/new" aria-label="New material PO" className="btn-primary !px-3 !py-2"><PlusIcon className="h-5 w-5" /></Link>}
      />
      {pos.length === 0 ? (
        <EmptyState
          icon={<DocumentIcon className="h-8 w-8" />}
          title="No material POs yet"
          message="Raise a purchase order to a supplier for base fabric or embellishments; receiving it brings the materials into stock."
          actionLabel="New material PO"
          actionHref="/material-orders/new"
        />
      ) : (
        <ul className="space-y-2 p-4">
          {pos.map((po) => {
            const value = po.items.reduce((s, i) => s + (i.rate ?? 0) * i.qtyOrdered, 0);
            const badge = STATUS[po.status] ?? { label: po.status, cls: "bg-gray-100 text-gray-700" };
            return (
              <li key={po.id}>
                <Link href={`/material-orders/${po.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{materialPoDocNo(po)} · {po.vendor.name}</p>
                    <p className="truncate text-sm text-gray-500">{formatDate(po.issueDate)} · {po.items.length} line{po.items.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(value, po.currency)}</span>
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
