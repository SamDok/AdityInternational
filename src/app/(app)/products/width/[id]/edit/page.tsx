import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import VariantForm from "../../../VariantForm";
import DeleteButton from "@/components/DeleteButton";
import { updateVariant, deleteVariant } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function EditWidthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const variant = await prisma.product.findUnique({
    where: { id },
    include: { design: { include: { category: true } } },
  });
  if (!variant) notFound();

  const backHref = variant.designId ? `/products/design/${variant.designId}` : "/products";

  return (
    <div>
      <PageHeader
        title={`Edit ${variant.width || "width"}`}
        subtitle={variant.design ? `${variant.design.category.name} · ${variant.design.code}` : undefined}
        backHref={backHref}
      />
      <VariantForm initial={variant} action={updateVariant.bind(null, id)} submitLabel="Save changes" />
      <div className="p-4 pt-0">
        <DeleteButton
          action={deleteVariant.bind(null, id)}
          label="Delete this width"
          confirmMessage={`Delete ${variant.width || "this width"}? This can't be undone.`}
        />
      </div>
    </div>
  );
}
