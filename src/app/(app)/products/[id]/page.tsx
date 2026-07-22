import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  return (
    <div>
      <PageHeader
        title={product.name}
        subtitle={product.sku ?? undefined}
        backHref="/products"
        action={
          <Link href={`/products/${product.id}/edit`} className="btn-secondary !px-4 !py-2 text-sm">
            Edit
          </Link>
        }
      />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-sm text-gray-500">Sale price</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatMoney(product.salePrice, product.currency)}
            </p>
            <p className="text-xs text-gray-400">per {product.unit}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">In stock</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{product.stockQty}</p>
            <p className="text-xs text-gray-400">{product.unit}</p>
          </div>
        </div>
        <section className="card divide-y divide-gray-50">
          <Row label="Item code" value={product.sku} />
          <Row label="Description" value={product.description} />
          <Row label="Unit" value={product.unit} />
          <Row label="Currency" value={product.currency} />
        </section>
      </div>
    </div>
  );
}
