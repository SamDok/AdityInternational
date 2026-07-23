import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import CompanyProfileForm from "./CompanyProfileForm";
import { getCompanyProfile, getBankAccounts } from "../companyActions";

export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  await requireUser();
  const [profile, banks] = await Promise.all([getCompanyProfile(), getBankAccounts()]);

  return (
    <div>
      <PageHeader
        title="Company profile"
        subtitle="Used on your proforma invoices"
        backHref="/settings"
      />
      <CompanyProfileForm initial={profile} banks={banks} />
    </div>
  );
}
