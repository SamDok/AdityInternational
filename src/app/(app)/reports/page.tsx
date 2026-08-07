import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney } from "@/lib/format";
import { financialYearLabel } from "@/lib/jobNumber";
import { getCompanyProfile } from "../settings/companyActions";
import { shipmentGrandTotal, jobReceivedValue, sumByCurrency, balances, realizedFxGain } from "@/lib/money";

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

// currency → (key → amount). Ranking is kept WITHIN each currency, because a
// total that mixes USD + INR would be meaningless without conversion.
type Ranked = Map<string, Map<string, number>>;
function bump(agg: Ranked, currency: string, key: string, amount: number) {
  if (!(amount > 0)) return;
  let m = agg.get(currency);
  if (!m) { m = new Map(); agg.set(currency, m); }
  m.set(key, (m.get(key) ?? 0) + amount);
}

// A ranked-list card: for each currency, the top rows by value.
function RankCard({ title, hint, agg, unit, limit = 5 }: { title: string; hint?: string; agg: Ranked; unit?: string; limit?: number }) {
  const currencies = [...agg.keys()].sort();
  const hasAny = currencies.some((c) => (agg.get(c)?.size ?? 0) > 0);
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold text-gray-500">{title}{hint && <span className="ml-2 font-normal text-gray-400">{hint}</span>}</h2>
      {!hasAny ? (
        <p className="card text-sm text-gray-500">Nothing to show yet.</p>
      ) : (
        <div className="space-y-3">
          {currencies.map((cur) => {
            const rows = [...(agg.get(cur) ?? new Map())].sort((a, b) => b[1] - a[1]).slice(0, limit);
            if (rows.length === 0) return null;
            return (
              <div key={cur} className="card">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{cur}</p>
                <ol className="divide-y divide-gray-50">
                  {rows.map(([label, value], i) => (
                    <li key={label} className="flex items-center gap-3 py-2">
                      <span className="w-5 shrink-0 text-sm font-semibold text-gray-400">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{label}</span>
                      <span className="shrink-0 text-sm font-semibold text-gray-900">
                        {unit ? `${Math.round(value).toLocaleString("en-IN")} ${unit}` : formatMoney(value, cur)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default async function ReportsPage() {
  const company = await getCompanyProfile();
  const fyNow = financialYearLabel(new Date());

  const [shipments, payments, jobs, vendorPayments, products, orders, rawMaterials, materialPOs, customersFx] = await Promise.all([
    prisma.shipment.findMany({
      where: { status: { not: "CANCELLED" } },
      select: {
        date: true, currency: true, billToTaxId: true, status: true, isSample: true, discountPct: true, freight: true, insurance: true, otherCharges: true,
        customer: { select: { name: true, salesperson: { select: { name: true, email: true } } } },
        items: { select: { quantity: true, rate: true, product: { select: { design: { select: { gstRate: true, code: true, name: true } } } } } },
      },
    }),
    prisma.payment.findMany({ select: { amount: true, currency: true } }),
    prisma.job.findMany({ where: { status: { not: "CANCELLED" } }, select: { currency: true, items: { select: { qtyReceived: true, rate: true } } } }),
    prisma.vendorPayment.findMany({ select: { amount: true, currency: true } }),
    prisma.product.findMany({ where: { archived: false }, select: { stockQty: true, costPrice: true, currency: true } }),
    prisma.order.findMany({ where: { status: { not: "CANCELLED" }, isSample: false }, select: { currency: true, items: { select: { quantity: true, shippedQty: true, rate: true } } } }),
    prisma.rawMaterial.findMany({ where: { archived: false }, select: { stockQty: true, costPrice: true, currency: true } }),
    prisma.materialPurchaseOrder.findMany({ where: { status: { not: "CANCELLED" } }, select: { currency: true, items: { select: { qtyReceived: true, rate: true } } } }),
    prisma.customer.findMany({
      select: {
        shipments: { where: { status: { not: "CANCELLED" }, isSample: false }, select: { date: true, currency: true, status: true, fxRate: true, billToTaxId: true, discountPct: true, freight: true, insurance: true, otherCharges: true, items: { select: { quantity: true, rate: true, product: { select: { design: { select: { gstRate: true } } } } } } } },
        payments: { select: { amount: true, currency: true, fxRate: true, date: true } },
      },
    }),
  ]);

  // Sales exclude samples (a sample isn't real business). Receivable keeps all
  // shipments, so a *charged* sample you're still owed is not lost.
  const saleShipments = shipments.filter((s) => !s.isSample);
  const salesAll = sumByCurrency(saleShipments.map((s) => ({ amount: shipmentGrandTotal(s, company), currency: s.currency })));
  const salesFY = sumByCurrency(
    saleShipments.filter((s) => financialYearLabel(s.date) === fyNow).map((s) => ({ amount: shipmentGrandTotal(s, company), currency: s.currency })),
  );
  const billedAll = sumByCurrency(shipments.map((s) => ({ amount: shipmentGrandTotal(s, company), currency: s.currency })));
  const receivable = new Map(balances(billedAll, sumByCurrency(payments)).filter((b) => b.outstanding > 0.01).map((b) => [b.currency, b.outstanding]));

  // Payables: value received (job work + materials received) minus paid.
  const receivedValue = sumByCurrency([
    ...jobs.map((j) => ({ amount: jobReceivedValue(j), currency: j.currency })),
    ...materialPOs.map((po) => ({ amount: po.items.reduce((s, i) => s + (i.rate ?? 0) * i.qtyReceived, 0), currency: po.currency })),
  ]);
  const payable = new Map(balances(receivedValue, sumByCurrency(vendorPayments)).filter((b) => b.outstanding > 0.01).map((b) => [b.currency, b.outstanding]));

  // Order book: value still to ship on live orders.
  const backlog = sumByCurrency(
    orders.flatMap((o) => o.items.map((i) => ({ amount: Math.max(0, i.quantity - i.shippedQty) * i.rate, currency: o.currency }))),
  );

  // Stock valued at cost.
  const stockValue = sumByCurrency(
    products.filter((p) => p.costPrice != null && p.stockQty > 0).map((p) => ({ amount: p.stockQty * (p.costPrice as number), currency: p.currency })),
  );

  // Raw materials (base fabric + embellishments) on hand, valued at cost.
  const rawStockValue = sumByCurrency(
    rawMaterials.filter((m) => m.costPrice != null && m.stockQty > 0).map((m) => ({ amount: m.stockQty * (m.costPrice as number), currency: m.currency })),
  );

  // Realized FX gain/loss across all customers (foreign invoices paid at a
  // different rate than booked). Matched per customer so receipts don't cross.
  const realizedFx = customersFx.reduce((sum, c) => sum + realizedFxGain(
    c.shipments.map((s) => ({ total: shipmentGrandTotal(s, company), currency: s.currency, rate: s.fxRate, date: s.date })),
    c.payments.map((p) => ({ amount: p.amount, currency: p.currency, rate: p.fxRate, date: p.date })),
  ), 0);

  // Rankings for the current financial year, kept within each currency.
  const fyShipments = saleShipments.filter((s) => financialYearLabel(s.date) === fyNow);
  const topCustomers: Ranked = new Map();
  const bySalesperson: Ranked = new Map();
  const topDesignsValue: Ranked = new Map();
  const topDesignsQty: Ranked = new Map();
  for (const s of fyShipments) {
    const total = shipmentGrandTotal(s, company);
    bump(topCustomers, s.currency, s.customer?.name ?? "—", total);
    const sp = s.customer?.salesperson;
    bump(bySalesperson, s.currency, sp ? sp.name || sp.email : "Unassigned", total);
    for (const it of s.items) {
      const label = it.product.design ? `${it.product.design.code} · ${it.product.design.name}` : "—";
      bump(topDesignsValue, s.currency, label, it.quantity * it.rate);
      bump(topDesignsQty, s.currency, label, it.quantity);
    }
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle={`Financial year ${fyNow}`} backHref="/more" />
      <div className="grid grid-cols-2 gap-3 p-4">
        <MetricCard label={`Sales · FY ${fyNow}`} value={moneyLine(salesFY)} tone="brand" hint="Invoiced this year" />
        <MetricCard label="Order book" value={moneyLine(backlog)} hint="Still to ship on live orders" />
        <MetricCard label="To receive" value={moneyLine(receivable)} tone="green" hint="Outstanding from customers" />
        <MetricCard label="To pay" value={moneyLine(payable)} tone="red" hint="Outstanding to vendors" />
        <MetricCard label="Stock at cost" value={moneyLine(stockValue)} hint="Finished goods on hand" />
        <MetricCard label="Materials at cost" value={moneyLine(rawStockValue)} hint="Base fabric & materials on hand" />
        <MetricCard label="Sales · all time" value={moneyLine(salesAll)} hint="Total invoiced (excludes samples)" />
        {Math.abs(realizedFx) > 0.01 && (
          <MetricCard label="Realized FX" value={formatMoney(realizedFx, "INR")} tone={realizedFx >= 0 ? "green" : "red"} hint={realizedFx >= 0 ? "Gain on settled foreign invoices" : "Loss on settled foreign invoices"} />
        )}
      </div>

      <div className="space-y-5 px-4 pb-6">
        <RankCard title="Top customers" hint={`by sales · FY ${fyNow}`} agg={topCustomers} />
        <RankCard title="Top designs" hint={`by sales · FY ${fyNow}`} agg={topDesignsValue} />
        <RankCard title="Best-selling designs" hint={`by metres · FY ${fyNow}`} agg={topDesignsQty} unit="mtr" />
        <RankCard title="Salesperson performance" hint={`by sales · FY ${fyNow}`} agg={bySalesperson} />
      </div>
    </div>
  );
}
