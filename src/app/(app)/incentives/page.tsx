import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney, formatDate } from "@/lib/format";
import { shipmentDocNo, financialYearLabel } from "@/lib/jobNumber";
import { getHsnRates, shipmentIncentive, inputGstPaid, INCENTIVE_LABEL, type IncentiveType } from "@/lib/incentives";
import ClaimsPanel, { type ClaimRow } from "./ClaimsPanel";

export const dynamic = "force-dynamic";

function Card({ label, value, hint, tone = "gray" }: { label: string; value: string; hint?: string; tone?: "gray" | "green" | "amber" }) {
  const color = tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : "text-gray-900";
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default async function IncentivesPage() {
  const fyNow = financialYearLabel(new Date());
  const [rates, shipments, materialItems, claims] = await Promise.all([
    getHsnRates(),
    prisma.shipment.findMany({
      where: { status: { not: "CANCELLED" }, isSample: false, currency: { not: "INR" } },
      orderBy: { date: "desc" },
      select: {
        id: true, number: true, seq: true, fyLabel: true, date: true, currency: true, fxRate: true, shippingBillNo: true,
        items: { select: { quantity: true, rate: true, product: { select: { design: { select: { hsnCode: true } } } } } },
      },
    }),
    prisma.materialPOItem.findMany({
      where: { po: { status: { not: "CANCELLED" } }, gstRate: { not: null } },
      select: { qtyReceived: true, rate: true, gstRate: true },
    }),
    prisma.incentiveClaim.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, type: true, fyLabel: true, amount: true, status: true, reference: true,
        filedDate: true, receivedDate: true, receivedAmount: true,
        shipment: { select: { number: true, seq: true, fyLabel: true } },
      },
    }),
  ]);

  const claimRows: ClaimRow[] = claims.map((c) => ({
    id: c.id, type: c.type,
    title: INCENTIVE_LABEL[c.type as IncentiveType] ?? c.type,
    sub: c.shipment ? shipmentDocNo(c.shipment, "BG") : c.fyLabel ? `FY ${c.fyLabel}` : "—",
    amount: c.amount, status: c.status, reference: c.reference,
    filedDate: c.filedDate ? c.filedDate.toISOString() : null,
    receivedDate: c.receivedDate ? c.receivedDate.toISOString() : null,
    receivedAmount: c.receivedAmount,
  }));
  const dueFromGovt = claims.filter((c) => c.status !== "RECEIVED").reduce((a, c) => a + c.amount, 0);
  const receivedTotal = claims.filter((c) => c.status === "RECEIVED").reduce((a, c) => a + (c.receivedAmount ?? c.amount), 0);

  const rows = shipments.map((s) => {
    const inc = shipmentIncentive(
      s.items.map((i) => ({ amount: i.quantity * i.rate, hsnCode: i.product.design?.hsnCode ?? null })),
      s.currency, s.fxRate, rates,
    );
    const hsns = [...new Set(s.items.map((i) => i.product.design?.hsnCode).filter(Boolean) as string[])];
    const anyUnrated = hsns.some((h) => !rates.has(h));
    const anyUnverified = hsns.some((h) => rates.get(h) && !rates.get(h)!.verified);
    return { s, inc, anyUnrated, anyUnverified, isFy: financialYearLabel(s.date) === fyNow };
  });

  const fyRows = rows.filter((r) => r.isFy);
  const drawbackFy = fyRows.reduce((a, r) => a + r.inc.drawbackInr, 0);
  const rodtepFy = fyRows.reduce((a, r) => a + r.inc.rodtepInr, 0);
  const itcPool = inputGstPaid(materialItems);
  const needsAttention = rows.some((r) => r.anyUnrated || r.anyUnverified || (!r.inc.convertible));

  return (
    <div>
      <PageHeader
        title="Export incentives"
        subtitle={`Estimated · FY ${fyNow}`}
        backHref="/more"
        action={<Link href="/settings/incentive-rates" className="btn-secondary !px-3 !py-2 text-sm">Rates</Link>}
      />

      <div className="grid grid-cols-2 gap-3 p-4">
        <Card label={`Duty Drawback · FY ${fyNow}`} value={formatMoney(drawbackFy, "INR")} tone="green" hint="Auto-credited to your bank" />
        <Card label={`RoDTEP · FY ${fyNow}`} value={formatMoney(rodtepFy, "INR")} tone="green" hint="Issued as e-scrips" />
        <Card label="GST input pool (ITC)" value={formatMoney(itcPool, "INR")} hint="Input GST paid on materials — refundable on LUT exports" />
        <Card label="Due from government" value={formatMoney(dueFromGovt, "INR")} tone="amber" hint="Claimed, not yet received" />
      </div>

      <div className="px-2">
        <h2 className="px-2 pb-1 pt-2 text-sm font-semibold text-gray-500">Claims{receivedTotal > 0.5 ? ` · ${formatMoney(receivedTotal, "INR")} received` : ""}</h2>
        <div className="px-2">
          <ClaimsPanel claims={claimRows} />
        </div>
      </div>

      {rates.size === 0 && (
        <div className="mx-4 mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No HSN rates set yet. <Link href="/settings/incentive-rates" className="font-semibold underline">Add them</Link> to estimate drawback &amp; RoDTEP.
        </div>
      )}
      {needsAttention && rates.size > 0 && (
        <div className="mx-4 mb-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Rows marked ⚠ have an HSN with no rate, an <b>unverified</b> rate, or a missing FX rate — the estimate may be off until you fix them in <Link href="/settings/incentive-rates" className="font-semibold underline">Rates</Link> or on the shipment.
        </div>
      )}

      <div className="px-2 pb-8">
        <h2 className="px-2 pb-1 pt-2 text-sm font-semibold text-gray-500">Per export shipment</h2>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">No export shipments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="p-2">Invoice</th>
                  <th className="p-2">Shipping bill</th>
                  <th className="p-2 text-right">Drawback</th>
                  <th className="p-2 text-right">RoDTEP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(({ s, inc, anyUnrated, anyUnverified }) => (
                  <tr key={s.id}>
                    <td className="p-2">
                      <Link href={`/invoice/${s.id}`} className="font-medium text-gray-900 hover:underline">{shipmentDocNo(s, "BG")}</Link>
                      <span className="ml-1 text-xs text-gray-400">{formatDate(s.date)}</span>
                      {(anyUnrated || anyUnverified || !inc.convertible) && <span className="ml-1" title="needs attention">⚠</span>}
                    </td>
                    <td className="p-2 text-xs text-gray-600">{s.shippingBillNo || <span className="text-gray-300">—</span>}</td>
                    <td className="p-2 text-right tabular-nums text-gray-900">{inc.drawbackInr ? formatMoney(inc.drawbackInr, "INR") : "—"}</td>
                    <td className="p-2 text-right tabular-nums text-gray-900">{inc.rodtepInr ? formatMoney(inc.rodtepInr, "INR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
