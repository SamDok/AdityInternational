import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import {
  formatMoney, formatDate, STAGE_LABELS, STAGE_COLORS, type OrderStage,
  fulfillmentOf, orderComplete, orderBadge, orderNo,
} from "@/lib/format";

const SAMPLE_STATUS_LABEL: Record<string, string> = { PENDING: "Awaiting approval", APPROVED: "Approved", REJECTED: "Rejected" };
const SAMPLE_STATUS_COLOR: Record<string, string> = { PENDING: "bg-amber-100 text-amber-700", APPROVED: "bg-green-100 text-green-700", REJECTED: "bg-red-100 text-red-700" };
import { shipmentDocNo } from "@/lib/jobNumber";
import { shipmentGrandTotal, sumByCurrency, balances, allocateFIFO, paidState, PAID_LABEL, PAID_COLOR, realizedFxGain } from "@/lib/money";
import { getFxRates } from "@/lib/fx";
import { getCompanyProfile } from "../../settings/companyActions";
import PaymentForm from "../../money/PaymentForm";
import PaymentList from "../../money/PaymentList";
import { recordPayment, deletePayment } from "../../money/actions";
import { ChevronRightIcon, PlusIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, company] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        salesperson: true,
        orders: { orderBy: { orderDate: "desc" }, take: 20, include: { items: true } },
        shipments: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { date: "asc" },
          select: {
            id: true, number: true, seq: true, fyLabel: true, date: true, currency: true, status: true, billToTaxId: true, fxRate: true,
            discountPct: true, freight: true, insurance: true, otherCharges: true,
            items: { select: { quantity: true, rate: true, product: { select: { design: { select: { gstRate: true } } } } } },
          },
        },
        payments: { orderBy: { date: "desc" }, select: { id: true, amount: true, currency: true, fxRate: true, date: true, method: true, reference: true, note: true, shipmentId: true } },
      },
    }),
    getCompanyProfile(),
  ]);

  if (!customer) notFound();

  // Split the customer's orders so samples and real production aren't lumped together.
  const sampleOrders = customer.orders.filter((o) => o.isSample);
  const productionOrders = customer.orders.filter((o) => !o.isSample);

  const fxRates = Object.fromEntries(await getFxRates());
  // Realized FX gain/loss: foreign invoices booked at one rate, paid at another.
  const realizedFx = realizedFxGain(
    customer.shipments.map((s) => ({ total: shipmentGrandTotal(s, company), currency: s.currency, rate: s.fxRate, date: s.date })),
    customer.payments.map((p) => ({ amount: p.amount, currency: p.currency, rate: p.fxRate, date: p.date })),
  );

  // Money: invoice totals (incl. GST), balances per currency, per-invoice paid state.
  const invoices = customer.shipments.map((s) => ({
    id: s.id,
    docNo: shipmentDocNo(s, "INV"),
    date: s.date,
    currency: s.currency,
    total: shipmentGrandTotal(s, company),
  }));
  const billed = sumByCurrency(invoices.map((i) => ({ amount: i.total, currency: i.currency })));
  const paidByCur = sumByCurrency(customer.payments);
  const bs = balances(billed, paidByCur);
  // FIFO allocation per currency to derive each invoice's paid amount.
  const paidPerInvoice = new Map<string, number>();
  for (const [cur, total] of paidByCur) {
    const invs = invoices.filter((i) => i.currency === cur);
    const alloc = allocateFIFO(invs.map((i) => ({ id: i.id, total: i.total })), total);
    for (const [id, amt] of alloc) paidPerInvoice.set(id, amt);
  }
  const paymentRows = customer.payments.map((p) => ({
    ...p,
    against: p.shipmentId ? invoices.find((i) => i.id === p.shipmentId)?.docNo ?? null : null,
  }));

  const subtitleParts = [customer.code, customer.contactPerson].filter(Boolean);
  const waDigits = (customer.altPhone || customer.phone || "").replace(/[^\d]/g, "");

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={subtitleParts.length ? subtitleParts.join(" · ") : undefined}
        backHref="/customers"
        action={
          <Link href={`/customers/${customer.id}/edit`} className="btn-secondary !px-4 !py-2 text-sm">
            Edit
          </Link>
        }
      />

      <div className="space-y-4 p-4">
        {customer.archived && (
          <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
            This customer is archived. Unarchive from Edit to use them again.
          </div>
        )}

        {customer.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customer.tags.map((t) => (
              <span key={t} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {customer.phone && (
            <a href={`tel:${customer.phone}`} className="btn-secondary flex-1 !py-2 text-sm">Call</a>
          )}
          {waDigits && (
            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 !py-2 text-sm">WhatsApp</a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="btn-secondary flex-1 !py-2 text-sm">Email</a>
          )}
        </div>
        <Link href={`/orders/new?customerId=${customer.id}`} className="btn-primary w-full">
          <PlusIcon className="h-5 w-5" /> New order for this customer
        </Link>
        <Link href={`/customers/${customer.id}/prices`} className="btn-secondary w-full">
          Price list
        </Link>

        <section className="card divide-y divide-gray-50">
          <Row label="Contact person" value={customer.contactPerson} />
          <Row label="Phone" value={customer.phone} />
          <Row label="Alt phone" value={customer.altPhone} />
          <Row label="Email" value={customer.email} />
          <Row label="Category" value={customer.category} />
          <Row label="Salesperson" value={customer.salesperson ? customer.salesperson.name || customer.salesperson.email : null} />
          <Row label="Billing address" value={customer.address} />
          <Row label="Country" value={customer.country} />
          <Row label="Shipping address" value={customer.shippingAddress} />
          <Row label="Destination port" value={customer.destinationPort} />
          <Row label="Incoterms" value={customer.incoterms} />
          <Row label="Currency" value={customer.currency} />
          <Row label="Payment terms" value={customer.paymentTerms} />
          <Row label="Credit limit" value={customer.creditLimit != null ? formatMoney(customer.creditLimit, customer.currency) : null} />
          <Row label="Default discount" value={customer.defaultDiscount != null ? `${customer.defaultDiscount}%` : null} />
          <Row label="GST number" value={customer.gstin} />
          <Row label="Tax ID / VAT" value={customer.taxId} />
          <Row label="Notes" value={customer.notes} />
          <Row label="Added by" value={customer.createdByName} />
          <Row label="Last edited by" value={customer.updatedByName} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-gray-500">Money</h2>
            {invoices.length > 0 && (
              <Link href={`/statement/customer/${customer.id}`} className="text-sm font-medium text-brand-600 hover:underline">Statement</Link>
            )}
          </div>
          {bs.length === 0 ? (
            <p className="card text-sm text-gray-500">No invoices raised yet.</p>
          ) : (
            <div className="card space-y-2">
              {bs.map((b) => (
                <div key={b.currency} className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-500">Billed {formatMoney(b.billed, b.currency)} · Received {formatMoney(b.paid, b.currency)}</span>
                  <span className={`text-base font-bold ${b.outstanding > 0.01 ? "text-red-700" : "text-green-700"}`}>
                    {b.outstanding > 0.01 ? `${formatMoney(b.outstanding, b.currency)} due` : "Settled"}
                  </span>
                </div>
              ))}
              {customer.creditLimit != null && bs.some((b) => b.outstanding > customer.creditLimit!) && (
                <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">Over the {formatMoney(customer.creditLimit, customer.currency)} credit limit.</p>
              )}
              {Math.abs(realizedFx) > 0.01 && (
                <div className="flex items-baseline justify-between border-t border-gray-50 pt-2">
                  <span className="text-sm text-gray-500">Realized FX {realizedFx >= 0 ? "gain" : "loss"}</span>
                  <span className={`text-sm font-semibold ${realizedFx >= 0 ? "text-green-700" : "text-red-700"}`}>{formatMoney(realizedFx, "INR")}</span>
                </div>
              )}
            </div>
          )}

          {invoices.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-2xl bg-white ring-1 ring-gray-100">
              {invoices.map((inv) => {
                const st = paidState(inv.total, paidPerInvoice.get(inv.id) ?? 0);
                return (
                  <li key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Link href={`/invoice/${inv.id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="text-sm font-medium text-gray-900">{inv.docNo}</span>
                      <span className="ml-2 text-xs text-gray-500">{formatDate(inv.date)}</span>
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAID_COLOR[st]}`}>{PAID_LABEL[st]}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(inv.total, inv.currency)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <PaymentForm
            action={recordPayment.bind(null, customer.id)}
            defaultCurrency={customer.currency}
            allocations={invoices.map((i) => ({ id: i.id, label: `${i.docNo} · ${formatMoney(i.total, i.currency)}` }))}
            allocationKey="shipmentId"
            allocationLabel="Against invoice"
            buttonLabel="Record payment"
            fxRates={fxRates}
          />
          {paymentRows.length > 0 && <PaymentList payments={paymentRows} onDelete={deletePayment} />}
        </section>

        {sampleOrders.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Being sampled ({sampleOrders.length})</h2>
            <ul className="space-y-2">
              {sampleOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{orderNo(o)}</p>
                      <p className="text-sm text-gray-500">{formatDate(o.orderDate)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.sampleStatus ? SAMPLE_STATUS_COLOR[o.sampleStatus] ?? "bg-gray-100 text-gray-600" : "bg-purple-100 text-purple-700"}`}>
                      {o.sampleStatus ? SAMPLE_STATUS_LABEL[o.sampleStatus] ?? o.sampleStatus : "Sample"}
                    </span>
                    <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">
            Orders ({productionOrders.length})
          </h2>
          {productionOrders.length === 0 ? (
            <p className="card text-sm text-gray-500">No production orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {productionOrders.map((o) => {
                const total = o.items.reduce((s, i) => s + i.quantity * i.rate, 0);
                const showShip = o.status !== "CANCELLED" && (orderComplete(o) || fulfillmentOf(o.items) !== "NONE");
                const fb = orderBadge(o);
                return (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">{orderNo(o)}</p>
                        <p className="text-sm text-gray-500">{formatDate(o.orderDate)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${showShip ? fb.className : STAGE_COLORS[o.status as OrderStage] ?? "bg-gray-100 text-gray-700"}`}>
                        {showShip ? fb.label : STAGE_LABELS[o.status as OrderStage] ?? o.status}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatMoney(total, o.currency)}
                      </span>
                      <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
