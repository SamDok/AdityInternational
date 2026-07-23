import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import OrderForm from "../OrderForm";
import { createOrder } from "../actions";
import { getProductOptions } from "../productOptions";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, currency: true },
    }),
    getProductOptions(),
  ]);

  return (
    <div>
      <PageHeader title="New order" backHref="/orders" />
      <OrderForm
        customers={customers}
        products={products}
        defaultCustomerId={customerId}
        action={createOrder}
        submitLabel="Save order"
      />
    </div>
  );
}
