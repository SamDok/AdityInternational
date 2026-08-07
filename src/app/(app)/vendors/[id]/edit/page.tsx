import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import VendorForm from "../../VendorForm";
import ToggleButton from "../../../products/ToggleButton";
import DeleteButton from "@/components/DeleteButton";
import { updateVendor, setVendorArchived, deleteVendor } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) notFound();

  return (
    <div>
      <PageHeader title="Edit vendor" backHref={`/vendors/${id}`} />
      <VendorForm initial={vendor} action={updateVendor.bind(null, id)} submitLabel="Save changes" />
      <div className="space-y-2 p-4 pt-0">
        <ToggleButton action={setVendorArchived.bind(null, id, !vendor.archived)} undoAction={setVendorArchived.bind(null, id, vendor.archived)} label={vendor.archived ? "Unarchive vendor" : "Archive vendor"} toastMessage={vendor.archived ? "Vendor restored" : "Vendor archived"} />
        <DeleteButton action={deleteVendor.bind(null, id)} label="Delete vendor" confirmMessage={`Delete ${vendor.name}? This can't be undone.`} />
      </div>
    </div>
  );
}
