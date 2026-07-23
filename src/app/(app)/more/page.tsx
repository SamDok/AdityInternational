import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { UsersIcon, ClipboardIcon, GearIcon, BoxIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const [vendors, openJobs, lowStock] = await Promise.all([
    prisma.vendor.count({ where: { archived: false } }),
    prisma.job.count({ where: { status: { in: ["OPEN", "PARTIAL"] } } }),
    prisma.product.count({ where: { archived: false, reorderLevel: { not: null } } }),
  ]);

  const items = [
    { href: "/vendors", label: "Vendors", sub: `${vendors} kaarigars & suppliers`, icon: UsersIcon },
    { href: "/jobs", label: "Jobs", sub: `${openJobs} open`, icon: ClipboardIcon },
    { href: "/products/low-stock", label: "Low stock", sub: lowStock ? "items to watch" : "nothing tracked", icon: BoxIcon },
    { href: "/settings", label: "Settings", sub: "account & team", icon: GearIcon },
  ];

  return (
    <div>
      <PageHeader title="More" />
      <ul className="space-y-2 p-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link href={it.href} className="card flex items-center gap-3 hover:bg-gray-50">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{it.label}</p>
                  <p className="text-sm text-gray-500">{it.sub}</p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-gray-300" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
