import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatQty } from "@/lib/format";
import { ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function LowStockPage() {
  const rows = await prisma.product.findMany({
    where: { archived: false, reorderLevel: { not: null } },
    include: { design: { include: { category: true } } },
  });
  const low = rows
    .filter((v) => v.reorderLevel != null && v.stockQty <= v.reorderLevel)
    .sort((a, b) => a.stockQty - b.stockQty);

  return (
    <div>
      <PageHeader title="Low stock" subtitle={`${low.length} item${low.length !== 1 ? "s" : ""}`} backHref="/products" />
      {low.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-gray-500">
          Nothing is low on stock. Set a reorder level on a width to track it here.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 p-2">
          {low.map((v) => (
            <li key={v.id}>
              <Link
                href={v.designId ? `/products/design/${v.designId}` : "/products"}
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{v.name}</p>
                  <p className="truncate text-sm text-gray-500">
                    {v.design?.category.name ?? "Other"} · reorder at {v.reorderLevel} {v.unit}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-sm font-semibold text-red-700">
                  {formatQty(v.stockQty)} {v.unit}
                </span>
                <ChevronRightIcon className="h-5 w-5 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
