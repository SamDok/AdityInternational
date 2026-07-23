import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SettingsClient from "./SettingsClient";
import { BuildingIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireUser();
  const isOwner = me.role === "owner";

  const teammates = isOwner
    ? await prisma.user.findMany({
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, email: true, role: true },
      })
    : [];

  return (
    <div>
      <PageHeader title="Settings" backHref="/" />
      <div className="px-4 pt-4">
        <Link href="/settings/company" className="card flex items-center gap-3 hover:bg-gray-50">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
            <BuildingIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">Company profile</p>
            <p className="text-sm text-gray-500">Letterhead &amp; bank details for your proforma invoices</p>
          </div>
          <ChevronRightIcon className="h-5 w-5 text-gray-300" />
        </Link>
      </div>
      <SettingsClient me={me} teammates={teammates} isOwner={isOwner} />
    </div>
  );
}
