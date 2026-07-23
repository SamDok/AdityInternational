import PageHeader from "@/components/PageHeader";
import ImportClient from "./ImportClient";

export default function ImportProductsPage() {
  return (
    <div>
      <PageHeader title="Import products" backHref="/products" />
      <ImportClient />
    </div>
  );
}
