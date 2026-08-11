import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CategoryForm from "../../../CategoryForm";
import { updateCategory } from "../../../actions";
import DefaultMaterialsEditor from "../../../../materials/DefaultMaterialsEditor";
import { setCategoryMaterials } from "../../../../materials/actions";
import RouteEditor from "../../../RouteEditor";
import { setCategoryRoute } from "../../../routeActions";

export const dynamic = "force-dynamic";

export default async function EditTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [category, defaults, materials, routeSteps, kaarigars] = await Promise.all([
    prisma.productCategory.findUnique({ where: { id } }),
    prisma.categoryMaterial.findMany({ where: { categoryId: id }, select: { materialId: true, qtyPerPiece: true } }),
    prisma.rawMaterial.findMany({ where: { archived: false }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, unit: true } }),
    prisma.routeStep.findMany({ where: { categoryId: id }, orderBy: { seq: "asc" }, select: { name: true, vendorId: true, unit: true, ratioFromPrev: true, rate: true } }),
    prisma.vendor.findMany({ where: { archived: false, kind: { in: ["KAARIGAR", "BOTH"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!category) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${category.name}`} backHref="/products/manage-types" />
      <div className="space-y-4 p-4">
        <div className="card">
          <CategoryForm initial={category} action={updateCategory.bind(null, id)} submitLabel="Save changes" />
        </div>
        <DefaultMaterialsEditor
          title="Default materials for this type"
          hint="Set the base fabric / materials every design of this type is made on. They pre-fill when you issue materials to a kaarigar."
          materials={materials}
          initial={defaults}
          action={setCategoryMaterials.bind(null, id)}
        />
        <RouteEditor
          title="Production route for this type"
          hint="Only if a design passes through more than one kaarigar in sequence (e.g. dupion: dye the yarn in kg, then weave into fabric in mtr). Leave empty for one-step designs. Orders auto-create the first step; each handoff is one tap."
          vendors={kaarigars}
          initial={routeSteps}
          action={setCategoryRoute.bind(null, id)}
        />
      </div>
    </div>
  );
}
