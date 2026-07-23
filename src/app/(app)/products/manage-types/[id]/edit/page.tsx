import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CategoryForm from "../../../CategoryForm";
import { updateCategory } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function EditTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await prisma.productCategory.findUnique({ where: { id } });
  if (!category) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${category.name}`} backHref="/products/manage-types" />
      <div className="p-4">
        <div className="card">
          <CategoryForm initial={category} action={updateCategory.bind(null, id)} submitLabel="Save changes" />
        </div>
      </div>
    </div>
  );
}
