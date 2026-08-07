import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { formatMoney } from "@/lib/format";
import { shipmentDocNo } from "@/lib/jobNumber";
import { INCENTIVE_LABEL, suggestClaim, type IncentiveType } from "@/lib/incentives";
import BankStatementImport from "../BankStatementImport";
import ReconcileList, { type CreditRow, type ClaimOpt, type ReconciledRow } from "../ReconcileList";

export const dynamic = "force-dynamic";

export default async function ReconcilePage() {
  await requireUser();
  const [credits, openClaims, reconciled] = await Promise.all([
    prisma.bankCredit.findMany({ where: { reconciled: false }, orderBy: { date: "desc" } }),
    prisma.incentiveClaim.findMany({
      where: { status: { not: "RECEIVED" } },
      select: { id: true, type: true, amount: true, reference: true, fyLabel: true, shipment: { select: { number: true, seq: true, fyLabel: true } } },
    }),
    prisma.bankCredit.findMany({ where: { reconciled: true }, orderBy: { date: "desc" }, take: 50, include: { claim: { select: { type: true, fyLabel: true, shipment: { select: { number: true, seq: true, fyLabel: true } } } } } }),
  ]);

  const claimLabel = (c: { type: string; amount?: number; fyLabel: string | null; shipment: { number: number; seq: number | null; fyLabel: string | null } | null }) => {
    const who = c.shipment ? shipmentDocNo(c.shipment, "BG") : c.fyLabel ? `FY ${c.fyLabel}` : "";
    return `${INCENTIVE_LABEL[c.type as IncentiveType] ?? c.type} · ${who}`;
  };

  const claimOpts: ClaimOpt[] = openClaims.map((c) => ({ id: c.id, label: `${claimLabel(c)} · ${formatMoney(c.amount, "INR")}` }));
  const matchClaims = openClaims.map((c) => ({ id: c.id, type: c.type, amount: c.amount, reference: c.reference }));

  const creditRows: CreditRow[] = credits.map((cr) => {
    const s = suggestClaim({ amount: cr.amount, narration: cr.narration }, matchClaims);
    return { id: cr.id, date: cr.date.toISOString(), amount: cr.amount, narration: cr.narration, reference: cr.reference, suggestedClaimId: s?.claimId ?? null, confidence: s?.confidence ?? null };
  });

  const reconciledRows: ReconciledRow[] = reconciled.map((cr) => ({
    id: cr.id, date: cr.date.toISOString(), amount: cr.amount, narration: cr.narration,
    claimLabel: cr.claim ? claimLabel(cr.claim) : "—",
  }));

  return (
    <div>
      <PageHeader title="Reconcile incentives" subtitle="Match bank credits to claims" backHref="/incentives" />
      <div className="space-y-4 p-4">
        <BankStatementImport />
        <ReconcileList credits={creditRows} claims={claimOpts} reconciled={reconciledRows} />
      </div>
    </div>
  );
}
