import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SettingsClient from "./SettingsClient";
import BackupButton from "./BackupButton";
import ImportCatalogueButton from "./ImportCatalogueButton";
import { BuildingIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";
// The one-time catalogue import writes ~2,570 designs; give it room on Vercel.
export const maxDuration = 60;

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
      {isOwner && (
        <>
          <div className="px-4 pt-4">
            <p className="mb-2 px-1 text-sm font-semibold text-gray-500">Catalogue</p>
            <ImportCatalogueButton />
            <p className="mt-1.5 px-1 text-xs text-gray-400">One-time load of your full design library. Safe to run again — designs are updated, not duplicated.</p>
          </div>
          <div className="px-4 pb-8 pt-4">
            <p className="mb-2 px-1 text-sm font-semibold text-gray-500">Backup</p>
            <BackupButton />
            <p className="mt-1.5 px-1 text-xs text-gray-400">Downloads all your data as a JSON file you can keep safe.</p>
          </div>
        </>
      )}
    </div>
  );
}
