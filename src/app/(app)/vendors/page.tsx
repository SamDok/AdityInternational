import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ProductSearch from "../products/ProductSearch";
import { UsersIcon, PlusIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { KAARIGAR: "Kaarigar", SUPPLIER: "Supplier", BOTH: "Kaarigar & Supplier" };

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const kind = sp.kind ?? "";

  const where: Prisma.VendorWhereInput = {
    archived: false,
    ...(kind ? { kind } : {}),
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ] } : {}),
  };

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { jobs: true, designs: true } } } }),
    prisma.vendor.count({ where: { archived: false } }),
  ]);

  const tabs = [["", "All"], ["KAARIGAR", "Kaarigars"], ["SUPPLIER", "Suppliers"]] as const;

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={total ? `${vendors.length} shown` : undefined}
        backHref="/more"
        action={
          <Link href="/vendors/new" aria-label="Add vendor" className="btn-primary !px-3 !py-2">
            <PlusIcon className="h-5 w-5" />
          </Link>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8" />}
          title="No vendors yet"
          message="Add your kaarigars and trading suppliers. You'll assign them to designs and jobs."
          actionLabel="Add your first vendor"
          actionHref="/vendors/new"
        />
      ) : (
        <>
          <ProductSearch q={q} placeholder="Search name, code, phone…" />
          <div className="flex gap-2 px-4 pt-2">
            {tabs.map(([value, label]) => (
              <Link key={value} href={value ? `/vendors?kind=${value}` : "/vendors"}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${kind === value ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-gray-50 text-gray-700 ring-gray-200"}`}>
                {label}
              </Link>
            ))}
          </div>

          {vendors.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">No vendors match.</p>
          ) : (
            <ul className="divide-y divide-gray-100 p-2">
              {vendors.map((v) => (
                <li key={v.id}>
                  <div className="flex items-center gap-2 rounded-xl px-2 py-3 hover:bg-gray-50">
                    <Link href={`/vendors/${v.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-600">
                        {v.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{v.name}</p>
                        <p className="truncate text-sm text-gray-500">
                          {[v.code, KIND_LABEL[v.kind], v.phone].filter(Boolean).join(" · ")}
                          {v._count.jobs > 0 && ` · ${v._count.jobs} job${v._count.jobs > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </Link>
                    <Link href={`/jobs/new?vendorId=${v.id}`} className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white active:bg-brand-700">
                      Job
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
