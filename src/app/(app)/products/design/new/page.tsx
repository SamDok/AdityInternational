import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import DesignForm from "../../DesignForm";
import { createDesign } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewDesignPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [categories, vendors] = await Promise.all([
    prisma.productCategory.findMany({
      where: { archived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="New design" backHref="/products" />
      <DesignForm categories={categories} vendors={vendors} initial={{ categoryId: category }} action={createDesign} submitLabel="Save design" />
    </div>
  );
}
