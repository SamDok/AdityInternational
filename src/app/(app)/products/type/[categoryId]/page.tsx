import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { BoxIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function TypePage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const category = await prisma.productCategory.findUnique({
    where: { id: categoryId },
    include: {
      designs: {
        orderBy: { code: "asc" },
        include: { _count: { select: { variants: true } } },
      },
    },
  });
  if (!category) notFound();

  return (
    <div>
      <PageHeader
        title={category.name}
        subtitle={`${category.designs.length} design${category.designs.length !== 1 ? "s" : ""}`}
        backHref="/products"
        action={
          <Link href={`/products/design/new?category=${category.id}`} aria-label="Add design" className="btn-primary !px-3 !py-2">
            <PlusIcon className="h-5 w-5" />
          </Link>
        }
      />

      {category.designs.length === 0 ? (
        <EmptyState
          icon={<BoxIcon className="h-8 w-8" />}
          title="No designs yet"
          message={`Add design codes under ${category.name}, each with its own widths.`}
          actionLabel="Add a design"
          actionHref={`/products/design/new?category=${category.id}`}
        />
      ) : (
        <ul className="divide-y divide-gray-100 p-2">
          {category.designs.map((d) => (
            <li key={d.id}>
              <Link href={`/products/design/${d.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold text-gray-900">
                    {d.code}{d.name ? ` · ${d.name}` : ""}
                    {d.archived && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Archived</span>}
                  </p>
                  <p className="truncate text-sm text-gray-500">
                    {d._count.variants} width{d._count.variants !== 1 ? "s" : ""}{d.composition ? ` · ${d.composition}` : ""}
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
