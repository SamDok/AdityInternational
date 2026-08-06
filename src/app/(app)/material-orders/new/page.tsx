import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import MaterialPoForm from "../MaterialPoForm";
import { createMaterialPo } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewMaterialPoPage() {
  const [materials, suppliers] = await Promise.all([
    prisma.rawMaterial.findMany({ where: { archived: false }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, unit: true } }),
    prisma.vendor.findMany({ where: { archived: false, kind: { in: ["SUPPLIER", "BOTH"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader title="New material PO" backHref="/material-orders" />
      <MaterialPoForm materials={materials} suppliers={suppliers} action={createMaterialPo} submitLabel="Raise purchase order" />
    </div>
  );
}
