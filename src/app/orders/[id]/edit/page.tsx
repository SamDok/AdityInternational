import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import OrderForm from "../../OrderForm";
import { updateOrder, deleteOrder } from "../../actions";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, customers, products] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { items: true } }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, currency: true } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, salePrice: true } }),
  ]);

  if (!order) notFound();

  const update = updateOrder.bind(null, id);
  const remove = deleteOrder.bind(null, id);

  const initial = {
    customerId: order.customerId,
    currency: order.currency,
    status: order.status,
    orderDate: order.orderDate.toISOString(),
    dueDate: order.dueDate?.toISOString() ?? null,
    notes: order.notes,
    items: order.items.map((it) => ({
      productId: it.productId,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      rate: it.rate,
    })),
  };

  return (
    <div>
      <PageHeader title={`Edit order #${order.number}`} backHref={`/orders/${id}`} />
      <OrderForm customers={customers} products={products} initial={initial} action={update} submitLabel="Save changes" />
      <div className="p-4 pt-0">
        <DeleteButton action={remove} label="Delete order" confirmMessage={`Delete order #${order.number}? This can't be undone.`} />
      </div>
    </div>
  );
}
