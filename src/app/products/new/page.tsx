import PageHeader from "@/components/PageHeader";
import ProductForm from "../ProductForm";
import { createProduct } from "../actions";

export default function NewProductPage() {
  return (
    <div>
      <PageHeader title="New product" backHref="/products" />
      <ProductForm action={createProduct} submitLabel="Save product" />
    </div>
  );
}
