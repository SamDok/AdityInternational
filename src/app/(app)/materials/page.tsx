import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { formatQty, formatMoney } from "@/lib/format";
import { BoxIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  BASE_FABRIC: "Base fabric",
  EMBELLISHMENT: "Embellishment",
  THREAD: "Thread",
  OTHER: "Other",
};

export default async function MaterialsPage() {
  const materials = await prisma.rawMaterial.findMany({
    where: { archived: false },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: { supplier: { select: { name: true } } },
  });

  const lowCount = materials.filter((m) => m.reorderLevel != null && m.stockQty <= m.reorderLevel).length;

  return (
    <div>
      <PageHeader
        title="Materials"
        subtitle={materials.length ? `${materials.length} item${materials.length === 1 ? "" : "s"}${lowCount ? ` · ${lowCount} low` : ""}` : undefined}
        backHref="/products"
        action={<Link href="/materials/new" aria-label="New material" className="btn-primary !px-3 !py-2"><PlusIcon className="h-5 w-5" /></Link>}
      />

      <div className="px-4 pt-3">
        <Link href="/material-orders" className="card flex items-center gap-3 hover:bg-gray-50">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">Purchase orders</p>
            <p className="text-sm text-gray-500">Buy materials from suppliers &amp; receive into stock</p>
          </div>
          <ChevronRightIcon className="h-5 w-5 text-gray-300" />
        </Link>
      </div>

      {materials.length === 0 ? (
        <EmptyState
          icon={<BoxIcon className="h-8 w-8" />}
          title="No materials yet"
          message="Add the base fabrics and embellishments you issue to kaarigars — then raise purchase orders to stock them and issue them against jobs."
          actionLabel="Add material"
          actionHref="/materials/new"
        />
      ) : (
        <ul className="space-y-2 p-4">
          {materials.map((m) => {
            const low = m.reorderLevel != null && m.stockQty <= m.reorderLevel;
            return (
              <li key={m.id}>
                <Link href={`/materials/${m.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{m.name}</p>
                    <p className="truncate text-sm text-gray-500">
                      {KIND_LABEL[m.kind] ?? m.kind}
                      {m.supplier ? ` · ${m.supplier.name}` : ""}
                      {m.costPrice != null ? ` · ${formatMoney(m.costPrice, m.currency)}/${m.unit}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-semibold ${low ? "text-red-600" : "text-gray-900"}`}>{formatQty(m.stockQty)} {m.unit}</span>
                    {low && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Low</span>}
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
