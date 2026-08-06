import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { BoxIcon } from "@/components/Icons";
import { formatDate, formatQty } from "@/lib/format";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  JOB_RECEIVE: "Received from job",
  ORDER_SHIP: "Shipped on order",
  ORDER_UNSHIP: "Shipment reversed",
  MANUAL_ADJUST: "Manual adjustment",
  CUSTOMER_RETURN: "Customer return",
  VENDOR_REJECT: "Rejected to vendor",
};

export default async function MovementsPage() {
  const movements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { name: true, designId: true, unit: true } } },
  });

  const userIds = [...new Set(movements.map((m) => m.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userName = new Map(users.map((u) => [u.id, u.name || u.email]));

  return (
    <div>
      <PageHeader
        title="Stock movements"
        subtitle="Recent stock changes across the catalogue"
        backHref="/more"
        action={<Link href="/products/stock-report" className="btn-secondary !px-3 !py-2 text-sm">Stock report</Link>}
      />

      {movements.length === 0 ? (
        <EmptyState
          icon={<BoxIcon className="h-8 w-8" />}
          title="No stock movements yet"
          message="Receiving from a job, shipping an order, or a manual adjustment will show up here."
        />
      ) : (
        <ul className="divide-y divide-gray-100 p-2">
          {movements.map((m) => {
            const up = m.delta > 0;
            const who = m.userId ? userName.get(m.userId) : null;
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {m.product.designId ? (
                      <Link href={`/products/design/${m.product.designId}`} className="hover:underline">{m.product.name}</Link>
                    ) : m.product.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {REASON_LABEL[m.reason] ?? m.reason} · {formatDate(m.createdAt)}
                    {who ? ` · ${who}` : ""}
                    {m.orderId ? <> · <Link href={`/orders/${m.orderId}`} className="text-brand-600">order</Link></> : null}
                    {m.jobId ? <> · <Link href={`/jobs/${m.jobId}`} className="text-brand-600">job</Link></> : null}
                  </p>
                </div>
                <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${up ? "text-green-600" : "text-red-600"}`}>
                  {up ? "+" : ""}{formatQty(m.delta)} {m.product.unit}
                  {(m.pieces != null || m.weight != null) && (
                    <span className="block text-[11px] font-normal text-gray-400">
                      {[m.pieces != null ? `${up ? "+" : ""}${m.pieces} pcs` : null, m.weight != null ? `${m.weight > 0 ? "+" : ""}${formatQty(m.weight)} kg` : null].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
