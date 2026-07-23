import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { formatMoney } from "@/lib/format";
import { BoxIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";
import BulkWidthsForm from "../../BulkWidthsForm";
import StockAdjust from "../../StockAdjust";

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
      vendor: true,
      variants: { orderBy: { width: "asc" } },
    },
  });
  if (!design) notFound();

  const sourcingLabel =
    design.sourcingType === "JOB_WORK" ? "Job work" : design.sourcingType === "TRADING" ? "Trading" : null;

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

        {design.imageData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={design.imageData} alt={design.code} className="h-48 w-full rounded-2xl object-cover" />
        )}

        <section className="card divide-y divide-gray-50">
          <Row label="Type" value={design.category.name} />
          <Row label="Composition" value={design.composition} />
          <Row label="HSN code" value={design.hsnCode} />
          <Row label="Sourcing" value={sourcingLabel} />
          <Row label="Kaarigar / supplier" value={design.vendor?.name} />
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
              message="Add each width of this design, with its own GSM, cost and stock."
              actionLabel="Add the first width"
              actionHref={`/products/width/new?design=${design.id}`}
            />
          ) : (
            <ul className="space-y-2">
              {design.variants.map((v) => (
                <li key={v.id} className="card flex items-center gap-3">
                  <Link href={`/products/width/${v.id}/edit`} className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{v.width || "—"}{v.colour ? ` · ${v.colour}` : ""}</p>
                    <p className="truncate text-sm text-gray-500">
                      {v.gsm != null ? `${v.gsm} GSM` : ""}
                      {v.costPrice != null ? `${v.gsm != null ? " · " : ""}cost ${formatMoney(v.costPrice, v.currency)}` : ""}
                    </p>
                  </Link>
                  <StockAdjust variantId={v.id} stockQty={v.stockQty} unit={v.unit} />
                  <Link href={`/products/width/${v.id}/edit`} aria-label="Edit width">
                    <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <BulkWidthsForm designId={design.id} />
          </div>
        </section>
      </div>
    </div>
  );
}
