import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { planProcurement } from "../orders/procurement";
import GenerateProcurement from "../orders/GenerateProcurement";
import { fulfillmentOf, formatDate } from "@/lib/format";
import { ClipboardIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  // ── Still to procure: confirmed, not-fully-shipped orders with an outstanding
  //    shortfall not yet turned into a job (planProcurement nets out linked jobs).
  const confirmed = await prisma.order.findMany({
    where: { status: "CONFIRMED" },
    select: { id: true, number: true, customer: { select: { name: true } }, items: { select: { quantity: true, shippedQty: true } } },
    orderBy: { number: "asc" },
  });
  const active = confirmed.filter((o) => fulfillmentOf(o.items) !== "FULL");
  const planned = await Promise.all(active.map(async (o) => ({ order: o, plan: await planProcurement(o.id) })));
  const needs = planned.filter(({ plan }) => plan && (plan.groups.length > 0 || plan.unassigned.length > 0));

  // ── In progress: open/partial jobs with items still to be received.
  const jobs = await prisma.job.findMany({
    where: { status: { in: ["OPEN", "PARTIAL"] } },
    include: {
      vendor: { select: { name: true } },
      order: { select: { id: true, number: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
  });
  const now = new Date();

  return (
    <div>
      <PageHeader title="Procurement" subtitle="What to make/buy, and what's on its way" backHref="/more" />

      <div className="space-y-6 p-4">
        {/* Still to procure */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">
            Still to procure {needs.length > 0 && <span className="text-gray-400">· {needs.length}</span>}
          </h2>
          {needs.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              Every confirmed order is covered by stock or has its jobs raised. Nothing waiting.
            </p>
          ) : (
            <ul className="space-y-2">
              {needs.map(({ order, plan }) => (
                <li key={order.id} className="card space-y-2">
                  <Link href={`/orders/${order.id}`} className="font-semibold text-brand-600 hover:underline">
                    Order #{order.number} · {order.customer.name}
                  </Link>
                  {plan!.groups.map((g) => (
                    <div key={g.vendorId + g.kind} className="rounded-lg bg-gray-50 p-2 text-xs">
                      <span className="font-semibold text-gray-900">{g.vendorName}</span>
                      <span className="text-gray-400"> · {g.kind === "JOB_WORK" ? "Job work" : "Purchase"}</span>
                      <ul className="mt-0.5">
                        {g.lines.map((l) => (
                          <li key={l.productId} className="text-gray-600">{l.name} — <span className="font-medium text-gray-800">{l.shortfall} {l.unit}</span></li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {plan!.unassigned.length > 0 && (
                    <p className="text-xs text-amber-600">
                      {plan!.unassigned.length} line{plan!.unassigned.length > 1 ? "s" : ""} need a kaarigar/supplier set on the design first.
                    </p>
                  )}
                  {plan!.groups.length > 0 && <GenerateProcurement orderId={order.id} label="Generate jobs & purchase orders" />}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* In progress */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">
            Awaiting from kaarigars &amp; suppliers {jobs.length > 0 && <span className="text-gray-400">· {jobs.length}</span>}
          </h2>
          {jobs.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Nothing is out for making or purchase right now.</p>
          ) : (
            <ul className="space-y-2">
              {jobs.map((j) => {
                const outstanding = j.items.filter((i) => i.qtyReceived < i.qtyOrdered);
                const overdue = j.dueDate && j.dueDate < now;
                return (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="card block hover:bg-gray-50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">Job #{j.number} · {j.vendor.name}</p>
                        {j.dueDate && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                            {overdue ? "Overdue " : "Due "}{formatDate(j.dueDate)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {j.kind === "PURCHASE" ? "Purchase" : "Job work"}
                        {j.order && <> · from order #{j.order.number}</>}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {outstanding.map((i) => (
                          <li key={i.id} className="text-xs text-gray-600">
                            {i.product.name} — <span className="font-medium text-gray-800">{i.qtyOrdered - i.qtyReceived} {i.unit} left</span>
                            {i.qtyReceived > 0 && <span className="text-gray-400"> ({i.qtyReceived}/{i.qtyOrdered} received)</span>}
                          </li>
                        ))}
                      </ul>
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
