import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import MaterialForm from "../MaterialForm";
import { createMaterial } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewMaterialPage() {
  const suppliers = await prisma.vendor.findMany({
    where: { archived: false, kind: { in: ["SUPPLIER", "BOTH"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div>
      <PageHeader title="New material" backHref="/materials" />
      <MaterialForm action={createMaterial} suppliers={suppliers} submitLabel="Save material" />
    </div>
  );
}
