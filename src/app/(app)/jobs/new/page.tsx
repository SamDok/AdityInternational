import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import JobForm from "../JobForm";
import { createJob } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ vendorId?: string }>;
}) {
  const { vendorId } = await searchParams;
  const [vendors, productCount] = await Promise.all([
    prisma.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.count({ where: { archived: false } }),
  ]);

  return (
    <div>
      <PageHeader title="New job" backHref="/jobs" />
      <JobForm
        vendors={vendors}
        hasProducts={productCount > 0}
        defaultVendorId={vendorId}
        action={createJob}
        submitLabel="Save job"
      />
    </div>
  );
}
