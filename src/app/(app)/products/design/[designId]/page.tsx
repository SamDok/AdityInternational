import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { formatMoney } from "@/lib/format";
import { BoxIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function DesignPage({ params }: { params: Promise<{ designId: string }> }) {
  const { designId } = await params;
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: {
      category: true,
      variants: { orderBy: { width: "asc" } },
    },
  });
  if (!design) notFound();

  return (
    <div>
      <PageHeader
        title={design.code}
        subtitle={`${design.category.name}${design.name ? ` · ${design.name}` : ""}`}
        backHref={`/products/type/${design.categoryId}`}
        action={
          <Link href={`/products/design/${design.id}/edit`} className="btn-secondary !px-4 !py-2 text-sm">Edit</Link>
        }
      />

      <div className="space-y-4 p-4">
        {design.archived && (
          <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
            This design is archived.
          </div>
        )}

        <section className="card divide-y divide-gray-50">
          <Row label="Type" value={design.category.name} />
          <Row label="Composition" value={design.composition} />
          <Row label="HSN code" value={design.hsnCode} />
          <Row label="Notes" value={design.description} />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-gray-500">
              Widths ({design.variants.length})
            </h2>
            <Link href={`/products/width/new?design=${design.id}`} className="btn-primary !px-3 !py-1.5 text-sm">
              <PlusIcon className="h-4 w-4" /> Add width
            </Link>
          </div>

          {design.variants.length === 0 ? (
            <EmptyState
              icon={<BoxIcon className="h-8 w-8" />}
              title="No widths yet"
              message="Add each width of this design, with its own GSM, cost, sale price and stock."
              actionLabel="Add the first width"
              actionHref={`/products/width/new?design=${design.id}`}
            />
          ) : (
            <ul className="space-y-2">
              {design.variants.map((v) => (
                <li key={v.id}>
                  <Link href={`/products/width/${v.id}/edit`} className="card flex items-center gap-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{v.width || "—"}</p>
                      <p className="truncate text-sm text-gray-500">
                        {v.gsm != null ? `${v.gsm} GSM · ` : ""}{v.stockQty} {v.unit} in stock
                        {v.costPrice != null ? ` · cost ${formatMoney(v.costPrice, v.currency)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-gray-900">
                      {formatMoney(v.salePrice, v.currency)}
                    </span>
                    <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
