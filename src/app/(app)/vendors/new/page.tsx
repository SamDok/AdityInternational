import PageHeader from "@/components/PageHeader";
import VendorForm from "../VendorForm";
import { createVendor } from "../actions";

export default function NewVendorPage() {
  return (
    <div>
      <PageHeader title="New vendor" backHref="/vendors" />
      <VendorForm action={createVendor} submitLabel="Save vendor" />
    </div>
  );
}
