import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney, formatDate, formatQty } from "@/lib/format";
import { materialPoDocNo } from "@/lib/jobNumber";
import DeleteButton from "@/components/DeleteButton";
import ReceiveMaterials from "./ReceiveMaterials";
import { cancelMaterialPo, deleteMaterialPo } from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-blue-100 text-blue-700" },
  PARTIAL: { label: "Partial", cls: "bg-amber-100 text-amber-700" },
  RECEIVED: { label: "Received", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function MaterialPoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await prisma.materialPurchaseOrder.findUnique({
    where: { id },
    include: { vendor: true, items: { include: { material: { select: { name: true, unit: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!po) notFound();

  const badge = STATUS[po.status] ?? { label: po.status, cls: "bg-gray-100 text-gray-700" };
  const total = po.items.reduce((s, i) => s + (i.rate ?? 0) * i.qtyOrdered, 0);
  const canReceive = po.status === "OPEN" || po.status === "PARTIAL";

  return (
    <div>
      <PageHeader
        title={materialPoDocNo(po)}
        subtitle={po.vendor.name}
        backHref="/material-orders"
        action={<Link href={`/material-po/${po.id}`} className="btn-secondary !px-3 !py-2">Print</Link>}
      />

      <div className="space-y-4 p-4">
        <div className="card flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <p>{formatDate(po.issueDate)}</p>
            {po.dueDate && <p>Due {formatDate(po.dueDate)}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
            <span className="text-lg font-bold text-gray-900">{formatMoney(total, po.currency)}</span>
          </div>
        </div>

        <div>
          <p className="mb-2 px-1 text-sm font-semibold text-gray-500">Materials</p>
          <ul className="space-y-1.5">
            {po.items.map((it) => (
              <li key={it.id} className="card flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{it.material.name}</p>
                  <p className="text-xs text-gray-400">{formatQty(it.qtyReceived)} / {formatQty(it.qtyOrdered)} {it.unit} received{it.rate != null ? ` · ${formatMoney(it.rate, po.currency)}/${it.unit}` : ""}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatMoney((it.rate ?? 0) * it.qtyOrdered, po.currency)}</span>
              </li>
            ))}
          </ul>
        </div>

        {canReceive && (
          <ReceiveMaterials
            poId={po.id}
            items={po.items.map((it) => ({ id: it.id, name: it.material.name, unit: it.unit, qtyOrdered: it.qtyOrdered, qtyReceived: it.qtyReceived }))}
          />
        )}

        {po.notes && <div className="card text-sm text-gray-600">{po.notes}</div>}

        <div className="space-y-2 pt-2">
          {po.status !== "CANCELLED" && po.status !== "RECEIVED" && (
            <form action={cancelMaterialPo.bind(null, id)}><button type="submit" className="btn-secondary w-full">Cancel purchase order</button></form>
          )}
          <DeleteButton action={deleteMaterialPo.bind(null, id)} label="Delete PO" confirmMessage="Delete this purchase order? This can't be undone." />
        </div>
      </div>
    </div>
  );
}
