import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import StagePicker from "../StagePicker";
import ShipForm from "../ShipForm";
import UnshipButton from "../UnshipButton";
import DropLineButton from "../DropLineButton";
import GenerateProcurement from "../GenerateProcurement";
import { planProcurement } from "../procurement";
import { formatMoney, formatDate, fulfillmentOf, FULFILLMENT_LABELS, FULFILLMENT_COLORS } from "@/lib/format";
import { DocumentIcon, ChevronRightIcon } from "@/components/Icons";

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
      items: { include: { product: { include: { design: true } } } },
    },
  });
  if (!order) notFound();

  const total = order.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const totalPieces = order.items.reduce((s, i) => s + (i.pieces ?? 0), 0);
  const fulfillment = fulfillmentOf(order.items);
  const shipItems = order.items.map((it) => ({
    id: it.id,
    label: it.product.name,
    quantity: it.quantity,
    shippedQty: it.shippedQty,
    unit: it.unit,
    stockQty: it.product.stockQty,
  }));

  const plan = await planProcurement(id);
  const openJobCount = plan?.existingJobs.filter((j) => j.status === "OPEN" || j.status === "PARTIAL").length ?? 0;

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

        <StagePicker
          orderId={order.id}
          current={order.status}
          openJobs={openJobCount}
          fulfillment={order.status !== "CANCELLED" ? { label: FULFILLMENT_LABELS[fulfillment], className: FULFILLMENT_COLORS[fulfillment] } : undefined}
        />

        {order.status !== "CANCELLED" && <ShipForm orderId={order.id} items={shipItems} />}

        {/* Bill-to / ship-to snapshot (as it prints on the PDF) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <p className="px-1 text-sm text-gray-500">Payment terms: <span className="font-medium text-gray-700">{order.paymentTerms}</span></p>
        )}

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
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">Job #{j.number} · {j.vendorName}</span>
                        <span className="shrink-0 text-xs text-gray-500">{j.kind === "JOB_WORK" ? "Job work" : "Purchase"} · {JOB_STATUS_LABEL[j.status] ?? j.status}</span>
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {order.status === "CONFIRMED" && plan.groups.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{plan.existingJobs.length > 0 ? "Still to make / buy:" : "To fulfil this order, make / buy the shortfall:"}</p>
                {plan.groups.map((g) => (
                  <div key={g.vendorId + g.kind} className="rounded-xl bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {g.vendorName}
                      <span className="text-xs font-normal text-gray-400"> · {g.kind === "JOB_WORK" ? "Job work" : "Purchase"}{g.jobDueDate ? ` · due ${formatDate(g.jobDueDate)}` : ""}</span>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {g.lines.map((l) => (
                        <li key={l.productId} className="text-xs text-gray-600">
                          {l.name} — <span className="font-medium text-gray-800">{l.shortfall} {l.unit}</span>
                          <span className="text-gray-400"> (need {l.needed}, {l.available} in stock)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <GenerateProcurement orderId={order.id} label={plan.existingJobs.length > 0 ? "Generate remaining jobs" : "Generate jobs & purchase orders"} />
              </div>
            )}

            {plan.unassigned.length > 0 && (
              <p className="text-xs text-amber-600">
                {plan.unassigned.length} line{plan.unassigned.length > 1 ? "s" : ""} need a kaarigar/supplier set on the design (sourcing) before a job can be generated.
              </p>
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
                  {it.product.design?.imageData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.product.design.imageData} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-gray-100" />
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
                        ? `${it.pieces} pcs × ${it.perPieceQty} ${it.unit} = ${it.quantity} ${it.unit}`
                        : `${it.quantity} ${it.unit}`}
                      {" × "}{formatMoney(it.rate, order.currency)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {it.shippedQty > 0 ? (
                        <span className={it.shippedQty >= it.quantity ? "font-medium text-green-600" : "font-medium text-amber-600"}>
                          {it.shippedQty >= it.quantity ? "Shipped" : `Shipped ${it.shippedQty}/${it.quantity} ${it.unit}`}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not shipped</span>
                      )}
                      {(it.dueDate || order.dueDate) && (
                        <span className="text-gray-500">Due {formatDate(it.dueDate ?? order.dueDate!)}</span>
                      )}
                      {it.shippedQty > 0 && <UnshipButton itemId={it.id} shippedQty={it.shippedQty} unit={it.unit} />}
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
