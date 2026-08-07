import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import DesignForm from "../../../DesignForm";
import ToggleButton from "../../../ToggleButton";
import DeleteButton from "@/components/DeleteButton";
import { updateDesign, setDesignArchived, deleteDesign, duplicateDesign } from "../../../actions";
import DefaultMaterialsEditor from "../../../../materials/DefaultMaterialsEditor";
import { setDesignMaterials } from "../../../../materials/actions";

export const dynamic = "force-dynamic";

export default async function EditDesignPage({ params }: { params: Promise<{ designId: string }> }) {
  const { designId } = await params;
  const [design, categories, vendors, overrides, materials] = await Promise.all([
    prisma.design.findUnique({ where: { id: designId }, include: { image: { select: { designId: true } }, category: { select: { name: true, materialDefaults: { include: { material: { select: { name: true } } } } } } } }),
    prisma.productCategory.findMany({ where: { archived: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.designMaterial.findMany({ where: { designId }, select: { materialId: true, qtyPerPiece: true } }),
    prisma.rawMaterial.findMany({ where: { archived: false }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, unit: true } }),
  ]);
  if (!design) notFound();

  const typeDefaults = design.category.materialDefaults.map((d) => d.material.name);
  const hint = typeDefaults.length
    ? `Leave empty to use the ${design.category.name} default: ${typeDefaults.join(", ")}. Add materials here only if this design differs.`
    : `Materials specific to this design (overrides the ${design.category.name} type default).`;

  return (
    <div>
      <PageHeader title={`Edit ${design.code}`} backHref={`/products/design/${design.id}`} />
      <DesignForm categories={categories} vendors={vendors} initial={design} initialImageUrl={design.image ? `/designs/${design.id}/image` : null} action={updateDesign.bind(null, designId)} submitLabel="Save changes" />
      <div className="p-4 pt-0">
        <DefaultMaterialsEditor
          title="Materials for this design"
          hint={hint}
          materials={materials}
          initial={overrides}
          action={setDesignMaterials.bind(null, designId)}
        />
      </div>
      <div className="space-y-2 p-4 pt-0">
        <ToggleButton action={duplicateDesign.bind(null, designId)} label="Duplicate design" toastMessage="Design duplicated" />
        <ToggleButton
          action={setDesignArchived.bind(null, designId, !design.archived)}
          undoAction={setDesignArchived.bind(null, designId, design.archived)}
          label={design.archived ? "Unarchive design" : "Archive design"}
          toastMessage={design.archived ? "Design restored" : "Design archived"}
        />
        <DeleteButton
          action={deleteDesign.bind(null, designId)}
          label="Delete design"
          confirmMessage={`Delete design ${design.code}? This can't be undone.`}
        />
      </div>
    </div>
  );
}
