import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import PriceListClient from "../../PriceListClient";
import { getProductOptions } from "../../../orders/productOptions";

export const dynamic = "force-dynamic";

export default async function CustomerPricesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, options] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        prices: {
          orderBy: { updatedAt: "desc" },
          include: { product: true },
        },
      },
    }),
    getProductOptions(),
  ]);
  if (!customer) notFound();

  const prices = customer.prices.map((p) => ({
    id: p.id,
    productId: p.productId,
    label: p.product.name,
    price: p.price,
    currency: p.currency,
  }));

  return (
    <div>
      <PageHeader title="Price list" subtitle={customer.name} backHref={`/customers/${id}`} />
      <PriceListClient
        customerId={id}
        currency={customer.currency}
        options={options.map((o) => ({ id: o.id, label: o.label, group: o.group, cost: o.costPrice ?? null }))}
        prices={prices}
      />
    </div>
  );
}
