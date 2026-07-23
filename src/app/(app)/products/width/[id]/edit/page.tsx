import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import VariantForm from "../../../VariantForm";
import DeleteButton from "@/components/DeleteButton";
import { updateVariant, deleteVariant } from "../../../actions";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  JOB_RECEIVE: "Received from job",
  ORDER_SHIP: "Shipped on order",
  ORDER_UNSHIP: "Shipment reversed",
  MANUAL_ADJUST: "Manual adjustment",
};

export default async function EditWidthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const variant = await prisma.product.findUnique({
    where: { id },
    include: { design: { include: { category: true } } },
  });
  if (!variant) notFound();

  const backHref = variant.designId ? `/products/design/${variant.designId}` : "/products";

  // Recent stock movements for this variant (audit trail).
  const movements = await prisma.stockMovement.findMany({
    where: { productId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const userIds = [...new Set(movements.map((m) => m.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userName = new Map(users.map((u) => [u.id, u.name || u.email]));
  const unit = variant.unit || "mtr";

  return (
    <div>
      <PageHeader
        title={`Edit ${variant.width || "width"}`}
        subtitle={variant.design ? `${variant.design.category.name} · ${variant.design.code}` : undefined}
        backHref={backHref}
      />
      <VariantForm initial={variant} action={updateVariant.bind(null, id)} submitLabel="Save changes" />

      <div className="px-4 pb-2">
        <h2 className="mb-2 mt-2 text-sm font-semibold text-gray-900">Stock history</h2>
        {movements.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            No stock movements yet. Receiving from a job, shipping an order, or a manual adjustment will show here.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl ring-1 ring-inset ring-gray-100">
            {movements.map((m) => {
              const up = m.delta > 0;
              const who = m.userId ? userName.get(m.userId) : null;
              return (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{REASON_LABEL[m.reason] ?? m.reason}</p>
                    <p className="truncate text-xs text-gray-500">
                      {formatDate(m.createdAt)}
                      {who ? ` · ${who}` : ""}
                      {m.orderId ? <> · <Link href={`/orders/${m.orderId}`} className="text-brand-600">order</Link></> : null}
                      {m.jobId ? <> · <Link href={`/jobs/${m.jobId}`} className="text-brand-600">job</Link></> : null}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${up ? "text-green-600" : "text-red-600"}`}>
                    {up ? "+" : ""}{m.delta} {unit}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-4 pt-2">
        <DeleteButton
          action={deleteVariant.bind(null, id)}
          label="Delete this width"
          confirmMessage={`Delete ${variant.width || "this width"}? This can't be undone.`}
        />
      </div>
    </div>
  );
}
