import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import JobForm from "../JobForm";
import { createJob } from "../actions";
import { getProductOptions } from "../../orders/productOptions";

export const dynamic = "force-dynamic";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ vendorId?: string }>;
}) {
  const { vendorId } = await searchParams;
  const [vendors, products] = await Promise.all([
    prisma.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getProductOptions(),
  ]);

  return (
    <div>
      <PageHeader title="New job" backHref="/jobs" />
      <JobForm
        vendors={vendors}
        products={products.map((p) => ({ id: p.id, label: p.label, group: p.group, unit: p.unit }))}
        defaultVendorId={vendorId}
        action={createJob}
        submitLabel="Save job"
      />
    </div>
  );
}
