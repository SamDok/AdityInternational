import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CategoryForm from "../CategoryForm";
import { createCategory, setCategoryArchived } from "../actions";

export const dynamic = "force-dynamic";

export default async function ManageTypesPage() {
  const categories = await prisma.productCategory.findMany({
    orderBy: [{ archived: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { designs: true } } },
  });

  return (
    <div>
      <PageHeader title="Product types" backHref="/products" />
      <div className="space-y-6 p-4">
        <section className="card">
          <h2 className="mb-3 font-semibold text-gray-900">Add a type</h2>
          <CategoryForm action={createCategory} submitLabel="Add type" resetOnSuccess />
        </section>

        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="card flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold text-gray-900">
                  {c.name}
                  {c.archived && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Archived</span>}
                </p>
                <p className="text-sm text-gray-500">
                  {c._count.designs} design{c._count.designs !== 1 ? "s" : ""}{c.hsnCode ? ` · HSN ${c.hsnCode}` : ""}
                </p>
              </div>
              <Link href={`/products/manage-types/${c.id}/edit`} className="btn-secondary !px-3 !py-1.5 text-sm">Edit</Link>
              <form action={setCategoryArchived.bind(null, c.id, !c.archived)}>
                <button type="submit" className="rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100">
                  {c.archived ? "Restore" : "Archive"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
