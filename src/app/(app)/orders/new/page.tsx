import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import OrderForm from "../OrderForm";
import { createOrder, getCustomerPrices } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const [customers, productCount, initialPrices] = await Promise.all([
    prisma.customer.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, company: true, currency: true, address: true,
        gstin: true, taxId: true, shippingAddress: true, destinationPort: true,
        incoterms: true, paymentTerms: true, defaultDiscount: true,
      },
    }),
    prisma.product.count({ where: { archived: false } }),
    getCustomerPrices(customerId ?? ""),
  ]);

  return (
    <div>
      <PageHeader title="New order" backHref="/orders" />
      <OrderForm
        customers={customers}
        hasProducts={productCount > 0}
        initialPrices={initialPrices}
        defaultCustomerId={customerId}
        action={createOrder}
        submitLabel="Save order"
      />
    </div>
  );
}
