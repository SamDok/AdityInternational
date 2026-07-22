import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import OrderForm from "../OrderForm";
import { createOrder } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, currency: true } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, salePrice: true } }),
  ]);

  return (
    <div>
      <PageHeader title="New order" backHref="/orders" />
      <OrderForm customers={customers} products={products} action={createOrder} submitLabel="Save order" />
    </div>
  );
}
