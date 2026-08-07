import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import OrderForm from "../../OrderForm";
import { updateOrder, deleteOrder, getCustomerPrices } from "../../actions";
import DeleteButton from "@/components/DeleteButton";
import { orderNo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, customers, productCount] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { name: true, width: true, colour: true, design: { select: { code: true } } } } } } },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, company: true, currency: true, address: true,
        gstin: true, taxId: true, shippingAddress: true, destinationPort: true,
        incoterms: true, paymentTerms: true, defaultDiscount: true,
      },
    }),
    prisma.product.count({ where: { archived: false } }),
  ]);

  if (!order) notFound();
  const initialPrices = await getCustomerPrices(order.customerId);

  const update = updateOrder.bind(null, id);
  const remove = deleteOrder.bind(null, id);

  const initial = {
    customerId: order.customerId,
    currency: order.currency,
    status: order.status,
    orderDate: order.orderDate.toISOString(),
    dueDate: order.dueDate?.toISOString() ?? null,
    notes: order.notes,
    billToName: order.billToName,
    billToAddress: order.billToAddress,
    billToTaxId: order.billToTaxId,
    shipToName: order.shipToName,
    shipToAddress: order.shipToAddress,
    destinationPort: order.destinationPort,
    incoterms: order.incoterms,
    paymentTerms: order.paymentTerms,
    discountPct: order.discountPct,
    isSample: order.isSample,
    items: order.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productLabel: it.product.design
        ? `${it.product.design.code}${it.product.width ? ` · ${it.product.width}` : ""}${it.product.colour ? ` · ${it.product.colour}` : ""}`
        : it.product.name,
      description: it.description,
      quantity: it.quantity,
      pieces: it.pieces,
      perPieceQty: it.perPieceQty,
      dueDate: it.dueDate?.toISOString() ?? null,
      unit: it.unit,
      rate: it.rate,
    })),
  };

  return (
    <div>
      <PageHeader title={`Edit ${orderNo(order)}`} backHref={`/orders/${id}`} />
      <OrderForm customers={customers} hasProducts={productCount > 0} initialPrices={initialPrices} initial={initial} action={update} submitLabel="Save changes" />
      <div className="p-4 pt-0">
        <DeleteButton action={remove} label="Delete order" confirmMessage={`Delete ${orderNo(order)}? This can't be undone.`} />
      </div>
    </div>
  );
}
