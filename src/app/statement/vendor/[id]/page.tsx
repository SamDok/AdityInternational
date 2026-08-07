import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { jobDocNo, materialPoDocNo } from "@/lib/jobNumber";
import { jobReceivedValue } from "@/lib/money";
import { getCompanyProfile } from "../../../(app)/settings/companyActions";
import StatementDoc, { buildLedgers, type LedgerRow } from "../../StatementDoc";

export const dynamic = "force-dynamic";

export default async function VendorStatementPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [vendor, company] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id },
      include: {
        jobs: { where: { status: { not: "CANCELLED" } }, select: { id: true, kind: true, number: true, seq: true, fyLabel: true, issueDate: true, currency: true, items: { select: { qtyReceived: true, rate: true } } } },
        materialPos: { where: { status: { not: "CANCELLED" } }, select: { id: true, number: true, seq: true, fyLabel: true, issueDate: true, currency: true, items: { select: { qtyReceived: true, rate: true } } } },
        payments: { select: { amount: true, currency: true, date: true, method: true, reference: true } },
      },
    }),
    getCompanyProfile(),
  ]);
  if (!vendor) notFound();

  const jobEvents: (LedgerRow & { currency: string })[] = vendor.jobs
    .map((j) => ({ date: j.issueDate, currency: j.currency, label: "Job work received", ref: jobDocNo(j), debit: jobReceivedValue(j), credit: 0 }))
    .filter((e) => e.debit > 0.01);
  const materialEvents: (LedgerRow & { currency: string })[] = vendor.materialPos
    .map((po) => ({ date: po.issueDate, currency: po.currency, label: "Material purchase received", ref: materialPoDocNo(po), debit: Math.round(po.items.reduce((s, i) => s + (i.rate ?? 0) * i.qtyReceived, 0) * 100) / 100, credit: 0 }))
    .filter((e) => e.debit > 0.01);
  const paymentEvents: (LedgerRow & { currency: string })[] = vendor.payments.map((p) => ({
    date: p.date, currency: p.currency, label: "Payment made",
    ref: [p.method, p.reference].filter(Boolean).join(" ") || null, debit: 0, credit: p.amount,
  }));

  return (
    <StatementDoc
      company={company}
      title="Vendor Statement of Account"
      backHref={`/vendors/${vendor.id}`}
      backLabel="Back to vendor"
      partyLabel="Statement for"
      partyName={vendor.name}
      partyAddress={vendor.address}
      partyTaxLabel="GSTIN"
      partyTaxId={vendor.gstin}
      balanceNoun="Balance payable to vendor"
      ledgers={buildLedgers([...jobEvents, ...materialEvents, ...paymentEvents])}
    />
  );
}
