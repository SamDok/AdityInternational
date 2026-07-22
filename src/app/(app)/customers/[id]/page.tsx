import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney, formatDate, STATUS_LABELS, STATUS_COLORS, type OrderStatus } from "@/lib/format";
import { ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      salesperson: true,
      orders: { orderBy: { orderDate: "desc" }, take: 20, include: { items: true } },
    },
  });

  if (!customer) notFound();

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={customer.contactPerson ?? undefined}
        backHref="/customers"
        action={
          <Link href={`/customers/${customer.id}/edit`} className="btn-secondary !px-4 !py-2 text-sm">
            Edit
          </Link>
        }
      />

      <div className="space-y-4 p-4">
        <section className="card divide-y divide-gray-50">
          <Row label="Contact person" value={customer.contactPerson} />
          <Row label="Phone" value={customer.phone} />
          <Row label="Alt phone" value={customer.altPhone} />
          <Row label="Email" value={customer.email} />
          <Row label="Category" value={customer.category} />
          <Row label="Salesperson" value={customer.salesperson ? customer.salesperson.name || customer.salesperson.email : null} />
          <Row label="Billing address" value={customer.address} />
          <Row label="Country" value={customer.country} />
          <Row label="Shipping address" value={customer.shippingAddress} />
          <Row label="Destination port" value={customer.destinationPort} />
          <Row label="Incoterms" value={customer.incoterms} />
          <Row label="Currency" value={customer.currency} />
          <Row label="Payment terms" value={customer.paymentTerms} />
          <Row label="Credit limit" value={customer.creditLimit != null ? formatMoney(customer.creditLimit, customer.currency) : null} />
          <Row label="Default discount" value={customer.defaultDiscount != null ? `${customer.defaultDiscount}%` : null} />
          <Row label="GST number" value={customer.gstin} />
          <Row label="Tax ID / VAT" value={customer.taxId} />
          <Row label="Notes" value={customer.notes} />
        </section>

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">
            Orders ({customer.orders.length})
          </h2>
          {customer.orders.length === 0 ? (
            <p className="card text-sm text-gray-500">No orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {customer.orders.map((o) => {
                const total = o.items.reduce((s, i) => s + i.quantity * i.rate, 0);
                return (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">Order #{o.number}</p>
                        <p className="text-sm text-gray-500">{formatDate(o.orderDate)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status as OrderStatus] ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatMoney(total, o.currency)}
                      </span>
                      <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
