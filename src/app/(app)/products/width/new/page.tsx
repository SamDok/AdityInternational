import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import VariantForm from "../../VariantForm";
import { createVariant } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewWidthPage({
  searchParams,
}: {
  searchParams: Promise<{ design?: string }>;
}) {
  const { design: designId } = await searchParams;
  if (!designId) notFound();
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { category: true },
  });
  if (!design) notFound();

  return (
    <div>
      <PageHeader
        title="New width"
        subtitle={`${design.category.name} · ${design.code}`}
        backHref={`/products/design/${design.id}`}
      />
      <VariantForm action={createVariant.bind(null, design.id)} submitLabel="Save width" />
    </div>
  );
}
