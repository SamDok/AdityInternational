import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CatalogueFilters from "../CatalogueFilters";
import ExportButton from "../ExportButton";
import Pager from "@/components/Pager";
import { ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const type = sp.type ?? "";
  const composition = sp.composition ?? "";
  const stock = sp.stock ?? "all";
  const sort = sp.sort ?? "code";

  // "In stock" ⇔ some variant has stock; "out" ⇔ none does — expressible in the
  // DB, so the stock filter paginates too.
  const stockWhere: Prisma.DesignWhereInput =
    stock === "in" ? { variants: { some: { stockQty: { gt: 0 } } } }
    : stock === "out" ? { variants: { none: { stockQty: { gt: 0 } } } }
    : {};
  const where: Prisma.DesignWhereInput = {
    ...(type ? { categoryId: type } : {}),
    ...(composition ? { composition } : {}),
    ...stockWhere,
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { composition: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const PAGE_SIZE = 40;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const listInclude = {
    category: true,
    variants: { select: { stockQty: true } },
    image: { select: { designId: true } },
    _count: { select: { variants: true } },
  } as const;

  const [types, allComps] = await Promise.all([
    prisma.productCategory.findMany({ orderBy: [{ sortOrder: "asc" }], select: { id: true, name: true } }),
    prisma.design.findMany({ where: { composition: { not: null } }, select: { composition: true }, distinct: ["composition"] }),
  ]);

  // Sort by total stock needs a summed relation the DB can't order by, so that
  // one (rare) case loads the matched set and sorts in memory. Every other
  // sort/filter is paginated in the database — the catalogue never loads the
  // whole table just to show a page.
  let pagedDesigns: (Prisma.DesignGetPayload<{ include: typeof listInclude }> & { totalStock: number })[];
  let total: number;
  if (sort === "stock") {
    const rows = await prisma.design.findMany({ where, include: listInclude });
    const withStock = rows
      .map((d) => ({ ...d, totalStock: d.variants.reduce((s, v) => s + v.stockQty, 0) }))
      .sort((a, b) => b.totalStock - a.totalStock);
    total = withStock.length;
    pagedDesigns = withStock.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    const [rows, count] = await Promise.all([
      prisma.design.findMany({
        where,
        orderBy: sort === "recent" ? { createdAt: "desc" } : { code: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: listInclude,
      }),
      prisma.design.count({ where }),
    ]);
    total = count;
    pagedDesigns = rows.map((d) => ({ ...d, totalStock: d.variants.reduce((s, v) => s + v.stockQty, 0) }));
  }

  const compositions = allComps.map((c) => c.composition).filter(Boolean).sort() as string[];

  return (
    <div>
      <PageHeader
        title="All designs"
        subtitle={`${total} design${total === 1 ? "" : "s"}`}
        backHref="/products"
        action={<ExportButton />}
      />
      <CatalogueFilters
        q={q} type={type} composition={composition} stock={stock} sort={sort}
        types={types} compositions={compositions}
      />

      {total === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-gray-500">No designs match.</p>
      ) : (
        <ul className="divide-y divide-gray-100 p-2">
          {pagedDesigns.map((d) => (
            <li key={d.id}>
              <Link href={`/products/design/${d.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50">
                {d.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/designs/${d.id}/image`} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded-lg bg-brand-50" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{d.code}{d.name ? ` · ${d.name}` : ""}</p>
                  <p className="truncate text-sm text-gray-500">
                    {d.category.name} · {d._count.variants} width{d._count.variants !== 1 ? "s" : ""} · {d.totalStock} in stock
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager basePath="/products/all" params={{ q, type, composition, stock: stock === "all" ? undefined : stock, sort: sort === "code" ? undefined : sort }} page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
