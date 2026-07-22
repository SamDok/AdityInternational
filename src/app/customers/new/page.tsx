import PageHeader from "@/components/PageHeader";
import CustomerForm from "../CustomerForm";
import { createCustomer } from "../actions";

export default function NewCustomerPage() {
  return (
    <div>
      <PageHeader title="New customer" backHref="/customers" />
      <CustomerForm action={createCustomer} submitLabel="Save customer" />
    </div>
  );
}
