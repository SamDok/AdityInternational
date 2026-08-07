import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { shipmentDocNo } from "@/lib/jobNumber";
import { shipmentGrandTotal } from "@/lib/money";
import { getCompanyProfile } from "../../../(app)/settings/companyActions";
import StatementDoc, { buildLedgers, type LedgerRow } from "../../StatementDoc";

export const dynamic = "force-dynamic";

export default async function CustomerStatementPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [customer, company] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        shipments: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true, number: true, seq: true, fyLabel: true, date: true, currency: true, status: true, billToTaxId: true, discountPct: true, freight: true, insurance: true, otherCharges: true, items: { select: { quantity: true, rate: true, product: { select: { design: { select: { gstRate: true } } } } } } },
        },
        payments: { select: { amount: true, currency: true, date: true, method: true, reference: true } },
      },
    }),
    getCompanyProfile(),
  ]);
  if (!customer) notFound();

  const events: (LedgerRow & { currency: string })[] = [
    ...customer.shipments.map((s) => ({
      date: s.date, currency: s.currency, label: "Invoice", ref: shipmentDocNo(s, "INV"),
      debit: shipmentGrandTotal(s, company), credit: 0,
    })),
    ...customer.payments.map((p) => ({
      date: p.date, currency: p.currency, label: "Payment received",
      ref: [p.method, p.reference].filter(Boolean).join(" ") || null, debit: 0, credit: p.amount,
    })),
  ];

  return (
    <StatementDoc
      company={company}
      title="Customer Statement of Account"
      backHref={`/customers/${customer.id}`}
      backLabel="Back to customer"
      partyLabel="Statement for"
      partyName={customer.company || customer.name}
      partyAddress={customer.address}
      partyTaxLabel="GST/Tax ID"
      partyTaxId={customer.gstin || customer.taxId}
      balanceNoun="Balance due from customer"
      ledgers={buildLedgers(events)}
    />
  );
}
