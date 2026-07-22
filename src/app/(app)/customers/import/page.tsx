import PageHeader from "@/components/PageHeader";
import ImportClient from "./ImportClient";

export default function ImportCustomersPage() {
  return (
    <div>
      <PageHeader title="Import customers" backHref="/customers" />
      <ImportClient />
    </div>
  );
}
