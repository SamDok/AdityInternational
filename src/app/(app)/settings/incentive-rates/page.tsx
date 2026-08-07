import { prisma } from "@/lib/prisma";
import { requireUser, isOwner } from "@/lib/auth";
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import IncentiveRatesEditor from "./IncentiveRatesEditor";

export const dynamic = "force-dynamic";

const s = (n: number | null) => (n == null ? "" : String(n));

export default async function IncentiveRatesPage() {
  await requireUser();
  if (!(await isOwner())) redirect("/settings");

  const rows = await prisma.hsnIncentiveRate.findMany({ orderBy: { hsnCode: "asc" } });

  return (
    <div>
      <PageHeader title="Export incentive rates" subtitle="Duty Drawback & RoDTEP % by HSN" backHref="/settings" />
      <div className="p-4">
        <IncentiveRatesEditor
          initial={rows.map((r) => ({
            id: r.id, hsnCode: r.hsnCode,
            drawbackPct: s(r.drawbackPct), drawbackCap: s(r.drawbackCap), rodtepPct: s(r.rodtepPct),
            verified: r.verified, notes: r.notes ?? "",
          }))}
        />
      </div>
    </div>
  );
}
