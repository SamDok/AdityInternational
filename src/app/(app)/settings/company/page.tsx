import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import CompanyProfileForm from "./CompanyProfileForm";
import { getCompanyProfile } from "../companyActions";

export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  await requireUser();
  const profile = await getCompanyProfile();

  return (
    <div>
      <PageHeader
        title="Company profile"
        subtitle="Used on your proforma invoices"
        backHref="/settings"
      />
      <CompanyProfileForm initial={profile} />
    </div>
  );
}
