import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import StagePicker from "../StagePicker";
import DropLineButton from "../DropLineButton";
import GeneratePanel from "../GeneratePanel";
import { planProcurement } from "../procurement";
import { formatMoney, formatDate, fulfillmentOf, orderBadge, formatQty, roundQty } from "@/lib/format";
import { getFxRates, convert } from "@/lib/fx";
import { DocumentIcon, ChevronRightIcon } from "@/components/Icons";
import ToggleButton from "../../products/ToggleButton";
import { setOrderComplete, reorderOrder } from "../actions";

const JOB_STATUS_LABEL: Record<string, string> = { OPEN: "Open", PARTIAL: "Partial", RECEIVED: "Received", CANCELLED: "Cancelled" };

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: { include: { design: { include: { image: { select: { designId: true } } } } } } } },
    },
  });
  if (!order) notFound();

  // Actual raw materials issued to this order's job-work (used = issued − returned).
  const jobMaterials = await prisma.jobMaterial.findMany({
    where: { job: { orderId: id } },
    select: { qtyIssued: true, qtyReturned: true, material: { select: { costPrice: true, currency: true } } },
  });

  const total = order.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const totalPieces = order.items.reduce((s, i) => s + (i.pieces ?? 0), 0);

  // Margin: sale (order currency) vs cost. Cost = the kaarigar's making charge
  // (design cost price) plus the actual base fabric / materials issued. Costs may
  // be in a different currency for imported goods, so a blended margin is only
  // shown when every cost is in the same currency as the sale.
  const makingByCurrency = new Map<string, number>();
  for (const i of order.items) {
    if (i.product.costPrice == null) continue;
    makingByCurrency.set(i.product.currency, (makingByCurrency.get(i.product.currency) ?? 0) + i.quantity * i.product.costPrice);
  }
  const materialByCurrency = new Map<string, number>();
  for (const jm of jobMaterials) {
    if (jm.material.costPrice == null) continue;
    const used = jm.qtyIssued - jm.qtyReturned;
    if (used <= 0) continue;
    materialByCurrency.set(jm.material.currency, (materialByCurrency.get(jm.material.currency) ?? 0) + used * jm.material.costPrice);
  }
  const costByCurrency = new Map(makingByCurrency);
  for (const [cur, c] of materialByCurrency) costByCurrency.set(cur, (costByCurrency.get(cur) ?? 0) + c);

  // Cost in the sale currency: exact when all costs are already in it, else
  // converted via the reference FX rates (Settings) so export margins still show.
  const exactSameCur = costByCurrency.size === 1 && costByCurrency.has(order.currency) ? costByCurrency.get(order.currency)! : null;
  let costInSale: number | null = exactSameCur;
  let fxEstimated = false;
  if (costInSale == null && costByCurrency.size > 0) {
    const fxRates = await getFxRates();
    let sum = 0, ok = true;
    for (const [cur, amt] of costByCurrency) {
      const c = convert(amt, cur, order.currency, fxRates);
      if (c == null) { ok = false; break; }
      sum += c;
    }
    if (ok) { costInSale = sum; fxEstimated = true; }
  }
  const margin = costInSale != null ? total - costInSale : null;
  const marginPct = margin != null && total > 0 ? roundQty((margin / total) * 100) : null;
  const badge = orderBadge(order);
  const autoFull = fulfillmentOf(order.items) === "FULL";
  // Offer a manual "mark complete" on a confirmed order that isn't fully shipped
  // by metres and hasn't already been closed by hand.
  const canMarkComplete = order.status === "CONFIRMED" && !autoFull && !order.manualComplete;
  // Shippable when it's live, not complete, and something is left to send.
  const canShip = order.status !== "CANCELLED" && !order.manualComplete && !autoFull;

  const plan = await planProcurement(id);
  const openJobCount = plan?.existingJobs.filter((j) => j.status === "OPEN" || j.status === "PARTIAL").length ?? 0;
  // Vendors offered in the generate/assign controls (any active kaarigar or supplier).
  const vendors = await prisma.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } });

  // Products still being made on an open job for this order (drives the per-line
  // "Can't make this" toast wording).
  const openJobLines = await prisma.jobItem.findMany({
    where: { job: { orderId: id, status: { in: ["OPEN", "PARTIAL"] } } },
    select: { productId: true, qtyOrdered: true, qtyReceived: true },
  });
  const productsWithOpenJob = new Set(openJobLines.filter((l) => l.qtyReceived < l.qtyOrdered).map((l) => l.productId));

  // Prefer the frozen snapshot; fall back to the live customer for older orders.
  const billToName = order.billToName || order.customer.company || order.customer.name;
  const billToAddress = order.billToAddress || order.customer.address;
  const shipToName = order.shipToName || null;
  const shipToAddress = order.shipToAddress || order.customer.shippingAddress;

  return (
    <div>
      <PageHeader
        title={`Order #${order.number}`}
        subtitle={order.customer.name}
        backHref="/orders"
        action={
          <div className="flex gap-2">
            <Link href={`/proforma/${order.id}`} className="btn-secondary !px-3 !py-2 text-sm" aria-label="Proforma invoice">
              <DocumentIcon className="h-5 w-5" />
            </Link>
            <form action={reorderOrder.bind(null, order.id)}>
              <button type="submit" className="btn-secondary !px-3 !py-2 text-sm">Reorder</button>
            </form>
            <Link href={`/orders/${order.id}/edit`} className="btn-secondary !px-4 !py-2 text-sm">
              Edit
            </Link>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        <div className="card">
          <p className="text-sm text-gray-500">Placed {formatDate(order.orderDate)}</p>
          {order.dueDate && <p className="text-sm text-gray-500">Due {formatDate(order.dueDate)}</p>}
          {order.createdByName && <p className="text-xs text-gray-400">Created by {order.createdByName}</p>}
          <p className="mt-1 text-sm text-gray-500">
            <Link href={`/customers/${order.customerId}`} className="font-medium text-brand-600 hover:underline">
              {order.customer.name}
            </Link>
          </p>
        </div>

        {order.currency === "INR" && !order.customer.gstin && (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This is a domestic (INR) order but the customer has no GSTIN — the invoice will charge <b>IGST</b>, not CGST/SGST.{" "}
            <Link href={`/customers/${order.customerId}/edit`} className="font-semibold underline">Add their GSTIN</Link> for correct intra-state tax.
          </div>
        )}

        <StagePicker
          orderId={order.id}
          current={order.status}
          openJobs={openJobCount}
          fulfillment={order.status !== "CANCELLED" ? badge : undefined}
        />

        {canShip && (
          <Link href={`/shipments/new?customerId=${order.customerId}&orderId=${order.id}`} className="btn-primary w-full">
            Create shipment · invoice &amp; packing list
          </Link>
        )}

        {order.manualComplete ? (
          <div className="card flex items-center justify-between gap-3 bg-green-50">
            <span className="text-sm font-medium text-green-800">Marked complete{!autoFull ? " (measured metres a little short)" : ""}.</span>
            <div className="shrink-0">
              <ToggleButton action={setOrderComplete.bind(null, order.id, false)} label="Reopen" toastMessage="Order reopened" />
            </div>
          </div>
        ) : canMarkComplete ? (
          <ToggleButton action={setOrderComplete.bind(null, order.id, true)} label="Mark order complete" toastMessage="Order marked complete" />
        ) : null}

        {/* Bill-to / ship-to snapshot (as it prints on the PDF) — collapsed by default */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-100">
            Billing &amp; delivery details <span className="text-xs font-normal text-gray-400">— on the PDF</span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400 transition group-open:rotate-90" />
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bill to</p>
              <p className="mt-1 font-medium text-gray-900">{billToName}</p>
              {billToAddress && <p className="whitespace-pre-line text-sm text-gray-500">{billToAddress}</p>}
              {order.billToTaxId && <p className="mt-1 text-sm text-gray-500">GST/Tax: {order.billToTaxId}</p>}
            </div>
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ship to</p>
              {shipToName && <p className="mt-1 font-medium text-gray-900">{shipToName}</p>}
              {shipToAddress ? (
                <p className="whitespace-pre-line text-sm text-gray-500">{shipToAddress}</p>
              ) : (
                !shipToName && <p className="mt-1 text-sm text-gray-400">Same as bill-to</p>
              )}
              {order.destinationPort && <p className="mt-1 text-sm text-gray-500">Port: {order.destinationPort}</p>}
              {order.incoterms && <p className="text-sm text-gray-500">Incoterms: {order.incoterms}</p>}
            </div>
          </div>
          {order.paymentTerms && (
            <p className="mt-2 px-1 text-sm text-gray-500">Payment terms: <span className="font-medium text-gray-700">{order.paymentTerms}</span></p>
          )}
        </details>

        {/* Procurement — make/buy the shortfall from kaarigars & suppliers */}
        {order.status === "DRAFT" && plan && (plan.groups.length > 0 || plan.unassigned.length > 0) && (
          <p className="px-1 text-xs text-gray-400">Confirm this order to generate its kaarigar / supplier jobs.</p>
        )}
        {plan && order.status !== "CANCELLED" && (plan.existingJobs.length > 0 || (order.status === "CONFIRMED" && (plan.groups.length > 0 || plan.unassigned.length > 0))) && (
          <section className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Procurement</h2>

            {plan.existingJobs.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Jobs raised for this order</p>
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl ring-1 ring-inset ring-gray-100">
                  {plan.existingJobs.map((j) => (
                    <li key={j.id}>
                      <Link href={`/jobs/${j.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">Job {j.docNo} · {j.vendorName}</span>
                        <span className="shrink-0 text-xs text-gray-500">{j.kind === "JOB_WORK" ? "Job work" : "Purchase"} · {JOB_STATUS_LABEL[j.status] ?? j.status}</span>
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {order.status === "CONFIRMED" && (plan.groups.length > 0 || plan.unassigned.length > 0) && (
              <GeneratePanel
                orderId={order.id}
                groups={plan.groups}
                unassigned={plan.unassigned}
                vendors={vendors}
                existingCount={plan.existingJobs.length}
              />
            )}

            {order.status === "CONFIRMED" && plan.groups.length === 0 && plan.existingJobs.length === 0 && plan.unassigned.length === 0 && (
              <p className="text-sm text-gray-500">Everything is covered by stock — no jobs needed.</p>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Items</h2>
          <ul className="space-y-2">
            {order.items.map((it) => (
              <li key={it.id} className="card">
                <div className="flex items-start gap-3">
                  {it.product.design?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/designs/${it.product.design.id}/image`} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-gray-50 object-contain ring-1 ring-gray-100" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-[10px] text-gray-300 ring-1 ring-gray-100">No image</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">
                      {it.product.designId ? (
                        <Link href={`/products/design/${it.product.designId}`} className="hover:underline">
                          {it.product.name}
                        </Link>
                      ) : (
                        it.product.name
                      )}
                    </p>
                    {it.description && <p className="text-sm text-gray-500">{it.description}</p>}
                    <p className="mt-1 text-sm text-gray-500">
                      {it.pieces && it.perPieceQty != null
                        ? `${it.pieces} pcs × ${formatQty(it.perPieceQty)} ${it.unit} = ${formatQty(it.quantity)} ${it.unit}`
                        : `${formatQty(it.quantity)} ${it.unit}`}
                      {" × "}{formatMoney(it.rate, order.currency)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {it.shippedQty > 0 ? (
                        <span className={it.shippedQty >= it.quantity ? "font-medium text-green-600" : "font-medium text-amber-600"}>
                          {it.shippedQty >= it.quantity ? "Shipped" : `Shipped ${formatQty(it.shippedQty)}/${formatQty(it.quantity)} ${it.unit}`}
                          {it.shippedWeight > 0 ? ` · ${formatQty(it.shippedWeight)} kg` : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not shipped</span>
                      )}
                      {(it.dueDate || order.dueDate) && (
                        <span className="text-gray-500">Due {formatDate(it.dueDate ?? order.dueDate!)}</span>
                      )}
                      {order.status !== "CANCELLED" && it.shippedQty === 0 && order.items.length > 1 && (
                        <DropLineButton itemId={it.id} hasJob={productsWithOpenJob.has(it.productId)} />
                      )}
                    </div>
                  </div>
                  <p className="shrink-0 font-semibold text-gray-900">
                    {formatMoney(it.quantity * it.rate, order.currency)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="card flex items-center justify-between">
          <span className="text-base font-semibold text-gray-700">
            Total{totalPieces > 0 ? ` · ${totalPieces} pcs` : ""}
          </span>
          <span className="text-xl font-bold text-gray-900">{formatMoney(total, order.currency)}</span>
        </div>

        {costByCurrency.size > 0 && (
          <div className="card space-y-1">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Revenue</span><span className="font-medium text-gray-900">{formatMoney(total, order.currency)}</span></div>
            {[...makingByCurrency].map(([cur, c]) => (
              <div key={cur} className="flex justify-between text-sm"><span className="text-gray-500">Making (est.)</span><span className="font-medium text-gray-900">{formatMoney(c, cur)}</span></div>
            ))}
            {[...materialByCurrency].map(([cur, c]) => (
              <div key={cur} className="flex justify-between text-sm"><span className="text-gray-500">Materials issued</span><span className="font-medium text-gray-900">{formatMoney(c, cur)}</span></div>
            ))}
            {materialByCurrency.size === 0 && (
              <p className="text-xs text-gray-400">No materials issued yet — margin excludes fabric cost so far.</p>
            )}
            {margin != null ? (
              <>
                <div className="flex justify-between border-t border-gray-100 pt-1 text-sm font-semibold">
                  <span className="text-gray-700">Margin{fxEstimated ? " (est. FX)" : ""}</span>
                  <span className={margin >= 0 ? "text-green-700" : "text-red-700"}>
                    {formatMoney(margin, order.currency)}{marginPct != null ? ` · ${marginPct}%` : ""}
                  </span>
                </div>
                {fxEstimated && <p className="text-[11px] text-gray-400">Costs converted at your reference exchange rates (Settings → Exchange rates).</p>}
              </>
            ) : (
              <p className="pt-1 text-xs text-gray-400">Costs are in a different currency — add reference exchange rates in Settings to show an export margin.</p>
            )}
          </div>
        )}

        {order.notes && (
          <section className="card">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="mt-1 text-sm text-gray-900">{order.notes}</p>
          </section>
        )}
      </div>
    </div>
  );
}
