import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CustomerForm from "../CustomerForm";
import { createCustomer } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const teammates = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <div>
      <PageHeader title="New customer" backHref="/customers" />
      <CustomerForm teammates={teammates} action={createCustomer} submitLabel="Save customer" />
    </div>
  );
}
