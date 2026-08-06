import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFxRates } from "@/lib/fx";
import { formatDate } from "@/lib/format";
import FxRatesForm from "./FxRatesForm";

export const dynamic = "force-dynamic";

export default async function ExchangeRatesPage() {
  const me = await requireUser();
  if (me.role !== "owner") redirect("/settings");
  const [rates, latest] = await Promise.all([
    getFxRates(),
    prisma.fxRate.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  const initial: Record<string, number> = {};
  for (const [cur, r] of rates) if (cur !== "INR") initial[cur] = r;
  return (
    <div>
      <PageHeader title="Exchange rates" backHref="/settings" />
      <div className="p-4">
        <FxRatesForm initial={initial} lastUpdated={latest ? formatDate(latest.updatedAt) : null} />
      </div>
    </div>
  );
}
