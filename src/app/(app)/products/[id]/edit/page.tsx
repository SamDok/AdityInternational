import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import ProductForm from "../../ProductForm";
import { updateProduct, deleteProduct } from "../../actions";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  const update = updateProduct.bind(null, id);
  const remove = deleteProduct.bind(null, id);

  return (
    <div>
      <PageHeader title="Edit product" backHref={`/products/${id}`} />
      <ProductForm initial={product} action={update} submitLabel="Save changes" />
      <div className="p-4">
        <DeleteButton action={remove} label="Delete product" confirmMessage={`Delete ${product.name}? This can't be undone.`} />
      </div>
    </div>
  );
}
