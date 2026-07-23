import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ProductSearch from "./ProductSearch";
import { BoxIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim();

  if (q) {
    // Search mode: matching designs across all types.
    const designs = await prisma.design.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { composition: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { category: true, _count: { select: { variants: true } } },
      orderBy: { code: "asc" },
      take: 50,
    });

    return (
      <div>
        <PageHeader title="Products" backHref={undefined} />
        <ProductSearch q={q} />
        {designs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">No designs match “{q}”.</p>
        ) : (
          <ul className="divide-y divide-gray-100 p-2">
            {designs.map((d) => (
              <li key={d.id}>
                <Link href={`/products/design/${d.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{d.code}{d.name ? ` · ${d.name}` : ""}</p>
                    <p className="truncate text-sm text-gray-500">
                      {d.category.name} · {d._count.variants} width{d._count.variants !== 1 ? "s" : ""}
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

  const categories = await prisma.productCategory.findMany({
    where: { archived: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { designs: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Products"
        action={
          <div className="flex items-center gap-2">
            <Link href="/products/manage-types" className="btn-secondary !px-3 !py-2 text-sm">Types</Link>
            <Link href="/products/design/new" aria-label="Add design" className="btn-primary !px-3 !py-2">
              <PlusIcon className="h-5 w-5" />
            </Link>
          </div>
        }
      />
      <ProductSearch q="" />

      {categories.length === 0 ? (
        <EmptyState
          icon={<BoxIcon className="h-8 w-8" />}
          title="No product types yet"
          message="Add your main product types, then add designs and widths under each."
          actionLabel="Manage types"
          actionHref="/products/manage-types"
        />
      ) : (
        <ul className="space-y-2 p-4">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/products/type/${c.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <BoxIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">
                    {c._count.designs} design{c._count.designs !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
