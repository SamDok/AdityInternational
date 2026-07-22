import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CustomerForm from "../../CustomerForm";
import { updateCustomer, deleteCustomer } from "../../actions";
import DeleteButton from "@/components/DeleteButton";
import ArchiveButton from "../../ArchiveButton";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, teammates] = await Promise.all([
    prisma.customer.findUnique({ where: { id } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  if (!customer) notFound();

  const update = updateCustomer.bind(null, id);
  const remove = deleteCustomer.bind(null, id);

  return (
    <div>
      <PageHeader title="Edit customer" backHref={`/customers/${id}`} />
      <CustomerForm initial={customer} teammates={teammates} action={update} submitLabel="Save changes" />
      <div className="space-y-2 p-4">
        <ArchiveButton id={customer.id} archived={customer.archived} />
        <DeleteButton action={remove} label="Delete customer" confirmMessage={`Delete ${customer.name}? This can't be undone.`} />
      </div>
    </div>
  );
}
