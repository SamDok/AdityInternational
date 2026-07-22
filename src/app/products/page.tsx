import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { BoxIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={products.length ? `${products.length} total` : undefined}
        action={
          <Link href="/products/new" aria-label="Add product" className="btn-primary !px-3 !py-2">
            <PlusIcon className="h-5 w-5" />
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={<BoxIcon className="h-8 w-8" />}
          title="No products yet"
          message="Add the items you sell. You'll add them as lines on orders."
          actionLabel="Add your first product"
          actionHref="/products/new"
        />
      ) : (
        <ul className="divide-y divide-gray-100 p-2">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <BoxIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{p.name}</p>
                  <p className="truncate text-sm text-gray-500">
                    {p.stockQty} {p.unit} in stock{p.sku ? ` · ${p.sku}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-gray-900">
                  {formatMoney(p.salePrice, p.currency)}
                </span>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
