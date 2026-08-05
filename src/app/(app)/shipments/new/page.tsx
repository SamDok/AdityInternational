import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { ChevronRightIcon } from "@/components/Icons";
import { createShipment } from "../actions";
import { customerReadyLines } from "../ready";
import ShipmentBuilder from "../ShipmentBuilder";

export const dynamic = "force-dynamic";

export default async function NewShipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; orderId?: string }>;
}) {
  const sp = await searchParams;

  // Derive the customer (and currency) from the order when opened from one.
  let customerId = sp.customerId;
  let orderCurrency: string | undefined;
  if (sp.orderId) {
    const order = await prisma.order.findUnique({ where: { id: sp.orderId }, select: { customerId: true, currency: true } });
    if (order) { customerId = customerId ?? order.customerId; orderCurrency = order.currency; }
  }

  // No customer yet → pick one (those with an order on the books).
  if (!customerId) {
    const customers = await prisma.customer.findMany({
      where: { archived: false, orders: { some: { status: { not: "CANCELLED" } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return (
      <div>
        <PageHeader title="New shipment" subtitle="Pick the customer to ship to" backHref="/shipments" />
        {customers.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">No customers with open orders yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 p-2">
            {customers.map((c) => (
              <li key={c.id}>
                <Link href={`/shipments/new?customerId=${c.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50">
                  <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">{c.name}</span>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return (
      <div>
        <PageHeader title="New shipment" backHref="/shipments" />
        <p className="px-6 py-12 text-center text-sm text-gray-500">Customer not found.</p>
      </div>
    );
  }

  const lines = await customerReadyLines(customerId);

  const snapshot = {
    billToName: customer.company || customer.name || "",
    billToAddress: customer.address || "",
    billToTaxId: customer.gstin || customer.taxId || "",
    shipToName: "",
    shipToAddress: customer.shippingAddress || "",
    destinationPort: customer.destinationPort || "",
    destinationCountry: customer.country || "",
    incoterms: customer.incoterms || "",
    paymentTerms: customer.paymentTerms || "",
  };

  return (
    <div>
      <PageHeader title="New shipment" subtitle={customer.name} backHref="/shipments" />
      <ShipmentBuilder
        customerId={customer.id}
        customerName={customer.name}
        currency={orderCurrency ?? customer.currency}
        snapshot={snapshot}
        lines={lines}
        preselectOrderId={sp.orderId}
        action={createShipment}
      />
    </div>
  );
}
