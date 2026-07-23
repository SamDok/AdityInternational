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
  const categories = await prisma.productCategory.findMany({
    where: { archived: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader title="New design" backHref="/products" />
      <DesignForm categories={categories} initial={{ categoryId: category }} action={createDesign} submitLabel="Save design" />
    </div>
  );
}
