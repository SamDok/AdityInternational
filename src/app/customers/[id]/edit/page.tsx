import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CustomerForm from "../../CustomerForm";
import { updateCustomer, deleteCustomer } from "../../actions";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const update = updateCustomer.bind(null, id);
  const remove = deleteCustomer.bind(null, id);

  return (
    <div>
      <PageHeader title="Edit customer" backHref={`/customers/${id}`} />
      <CustomerForm initial={customer} action={update} submitLabel="Save changes" />
      <div className="p-4">
        <DeleteButton action={remove} label="Delete customer" confirmMessage={`Delete ${customer.name}? This can't be undone.`} />
      </div>
    </div>
  );
}
