import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import DesignForm from "../../../DesignForm";
import ToggleButton from "../../../ToggleButton";
import DeleteButton from "@/components/DeleteButton";
import { updateDesign, setDesignArchived, deleteDesign, duplicateDesign } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function EditDesignPage({ params }: { params: Promise<{ designId: string }> }) {
  const { designId } = await params;
  const [design, categories, vendors] = await Promise.all([
    prisma.design.findUnique({ where: { id: designId } }),
    prisma.productCategory.findMany({
      where: { archived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!design) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${design.code}`} backHref={`/products/design/${design.id}`} />
      <DesignForm categories={categories} vendors={vendors} initial={design} action={updateDesign.bind(null, designId)} submitLabel="Save changes" />
      <div className="space-y-2 p-4 pt-0">
        <ToggleButton action={duplicateDesign.bind(null, designId)} label="Duplicate design" />
        <ToggleButton
          action={setDesignArchived.bind(null, designId, !design.archived)}
          label={design.archived ? "Unarchive design" : "Archive design"}
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
