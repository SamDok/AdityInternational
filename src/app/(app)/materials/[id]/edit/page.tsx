import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import MaterialForm from "../../MaterialForm";
import { updateMaterial } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [material, suppliers] = await Promise.all([
    prisma.rawMaterial.findUnique({ where: { id } }),
    prisma.vendor.findMany({ where: { archived: false, kind: { in: ["SUPPLIER", "BOTH"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!material) notFound();
  return (
    <div>
      <PageHeader title="Edit material" backHref={`/materials/${id}`} />
      <MaterialForm initial={material} suppliers={suppliers} action={updateMaterial.bind(null, id)} submitLabel="Save changes" />
    </div>
  );
}
