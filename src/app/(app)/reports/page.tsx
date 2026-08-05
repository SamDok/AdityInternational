import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney } from "@/lib/format";
import { financialYearLabel } from "@/lib/jobNumber";
import { getCompanyProfile } from "../settings/companyActions";
import { shipmentGrandTotal, jobReceivedValue, sumByCurrency, balances } from "@/lib/money";

export const dynamic = "force-dynamic";

function moneyLine(m: Map<string, number>) {
  const rows = [...m].filter(([, v]) => Math.abs(v) > 0.01);
  return rows.length ? rows.map(([c, v]) => formatMoney(v, c)).join("  ·  ") : "—";
}

function MetricCard({ label, value, hint, tone = "gray" }: { label: string; value: string; hint?: string; tone?: "gray" | "green" | "red" | "brand" }) {
  const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-700" : tone === "brand" ? "text-brand-700" : "text-gray-900";
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default async function ReportsPage() {
  const company = await getCompanyProfile();
  const fyNow = financialYearLabel(new Date());

  const [shipments, payments, jobs, vendorPayments, products, orders] = await Promise.all([
    prisma.shipment.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { date: true, currency: true, billToTaxId: true, status: true, discountPct: true, freight: true, insurance: true, otherCharges: true, items: { select: { quantity: true, rate: true, product: { select: { design: { select: { gstRate: true } } } } } } },
    }),
    prisma.payment.findMany({ select: { amount: true, currency: true } }),
    prisma.job.findMany({ where: { status: { not: "CANCELLED" } }, select: { currency: true, items: { select: { qtyReceived: true, rate: true } } } }),
    prisma.vendorPayment.findMany({ select: { amount: true, currency: true } }),
    prisma.product.findMany({ where: { archived: false }, select: { stockQty: true, costPrice: true, currency: true } }),
    prisma.order.findMany({ where: { status: { not: "CANCELLED" } }, select: { currency: true, items: { select: { quantity: true, shippedQty: true, rate: true } } } }),
  ]);

  // Sales: all-time billed and this financial year.
  const billedAll = sumByCurrency(shipments.map((s) => ({ amount: shipmentGrandTotal(s, company), currency: s.currency })));
  const salesFY = sumByCurrency(
    shipments.filter((s) => financialYearLabel(s.date) === fyNow).map((s) => ({ amount: shipmentGrandTotal(s, company), currency: s.currency })),
  );
  const receivable = new Map(balances(billedAll, sumByCurrency(payments)).filter((b) => b.outstanding > 0.01).map((b) => [b.currency, b.outstanding]));

  // Payables: value received minus paid.
  const receivedValue = sumByCurrency(jobs.map((j) => ({ amount: jobReceivedValue(j), currency: j.currency })));
  const payable = new Map(balances(receivedValue, sumByCurrency(vendorPayments)).filter((b) => b.outstanding > 0.01).map((b) => [b.currency, b.outstanding]));

  // Order book: value still to ship on live orders.
  const backlog = sumByCurrency(
    orders.flatMap((o) => o.items.map((i) => ({ amount: Math.max(0, i.quantity - i.shippedQty) * i.rate, currency: o.currency }))),
  );

  // Stock valued at cost.
  const stockValue = sumByCurrency(
    products.filter((p) => p.costPrice != null && p.stockQty > 0).map((p) => ({ amount: p.stockQty * (p.costPrice as number), currency: p.currency })),
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle={`Financial year ${fyNow}`} backHref="/more" />
      <div className="grid grid-cols-2 gap-3 p-4">
        <MetricCard label={`Sales · FY ${fyNow}`} value={moneyLine(salesFY)} tone="brand" hint="Invoiced this year" />
        <MetricCard label="Order book" value={moneyLine(backlog)} hint="Still to ship on live orders" />
        <MetricCard label="To receive" value={moneyLine(receivable)} tone="green" hint="Outstanding from customers" />
        <MetricCard label="To pay" value={moneyLine(payable)} tone="red" hint="Outstanding to vendors" />
        <MetricCard label="Stock at cost" value={moneyLine(stockValue)} hint="On-hand valued at cost" />
        <MetricCard label="Sales · all time" value={moneyLine(billedAll)} hint="Total invoiced" />
      </div>
    </div>
  );
}
