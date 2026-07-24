import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ClipboardIcon, CartIcon, PlusIcon, GearIcon, ChevronRightIcon, SearchIcon } from "@/components/Icons";
import {
  formatMoney, formatDate, STAGE_LABELS, STAGE_COLORS, type OrderStage,
  fulfillmentOf, orderComplete, orderBadge,
} from "@/lib/format";
import { dueSoonSchedule } from "./orders/schedule";

export const dynamic = "force-dynamic";

function firstName(user: { name: string | null; email: string } | null): string {
  if (!user) return "";
  if (user.name) return user.name.split(" ")[0];
  return user.email.split("@")[0];
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [openJobs, orders] = await Promise.all([
    prisma.job.count({ where: { status: { in: ["OPEN", "PARTIAL"] } } }),
    prisma.order.findMany({
      orderBy: { orderDate: "desc" },
      take: 5,
      include: { customer: true, items: true },
    }),
  ]);

  // "Open" = not cancelled and not complete (per-line shipped, or hand-closed).
  const activeOrders = await prisma.order.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { manualComplete: true, items: { select: { quantity: true, shippedQty: true } } },
  });
  const openOrders = activeOrders.filter((o) => !orderComplete(o)).length;

  const { counts } = await dueSoonSchedule();
  const urgent = counts.overdue + counts.behind;
  const dueSoonTotal = counts.overdue + counts.behind + counts.soon;

  return (
    <div className="p-4">
      <header className="mb-6 flex items-start justify-between pt-4">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {firstName(user) ? `Hi ${firstName(user)}, welcome to` : "Welcome to"}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Aditya International</h1>
        </div>
        <Link href="/settings" aria-label="Settings" className="-mr-1 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <GearIcon className="h-6 w-6" />
        </Link>
      </header>

      {/* Deadline alert */}
      {urgent > 0 ? (
        <Link href="/schedule" className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-inset ring-red-200">
          <span className="text-lg">⚠️</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-700">{urgent} deliver{urgent === 1 ? "y" : "ies"} need attention</p>
            <p className="text-xs text-red-600">{counts.overdue} overdue · {counts.behind} behind schedule{counts.soon ? ` · ${counts.soon} due soon` : ""}</p>
          </div>
          <ChevronRightIcon className="h-5 w-5 text-red-400" />
        </Link>
      ) : counts.soon > 0 ? (
        <Link href="/schedule" className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-200">
          <span className="text-lg">🗓️</span>
          <p className="min-w-0 flex-1 text-sm font-medium text-amber-700">{counts.soon} deliver{counts.soon === 1 ? "y" : "ies"} due soon</p>
          <ChevronRightIcon className="h-5 w-5 text-amber-400" />
        </Link>
      ) : null}

      {/* Global search */}
      <form action="/search" className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          name="q"
          placeholder="Search customers, designs, orders…"
          className="w-full rounded-xl border-0 bg-white py-3 pl-10 pr-4 text-base shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
        />
      </form>

      {/* Today's work — the three things to check daily, each a direct link */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Link href="/orders" className="card text-center">
          <CartIcon className="mx-auto h-6 w-6 text-brand-500" />
          <p className="mt-2 text-2xl font-bold text-gray-900">{openOrders}</p>
          <p className="text-xs text-gray-500">To ship</p>
        </Link>
        <Link href="/jobs" className="card text-center">
          <ClipboardIcon className="mx-auto h-6 w-6 text-brand-500" />
          <p className="mt-2 text-2xl font-bold text-gray-900">{openJobs}</p>
          <p className="text-xs text-gray-500">To receive</p>
        </Link>
        <Link href="/schedule" className="card text-center">
          <span className="mx-auto block text-2xl leading-6">🗓️</span>
          <p className="mt-2 text-2xl font-bold text-gray-900">{dueSoonTotal}</p>
          <p className="text-xs text-gray-500">Due soon</p>
        </Link>
      </div>

      {/* Primary action (the "+" in the bar covers the rest) */}
      <div className="mb-6">
        <Link href="/orders/new" className="btn-primary w-full">
          <PlusIcon className="h-5 w-5" /> New order
        </Link>
      </div>

      {/* Recent orders */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-gray-500">Recent orders</h2>
          <Link href="/orders" className="text-sm font-medium text-brand-600">See all</Link>
        </div>
        {orders.length === 0 ? (
          <p className="card text-sm text-gray-500">No orders yet.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => {
              const total = o.items.reduce((s, i) => s + i.quantity * i.rate, 0);
              const showShip = o.status !== "CANCELLED" && (orderComplete(o) || fulfillmentOf(o.items) !== "NONE");
              const fb = orderBadge(o);
              return (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">#{o.number} · {o.customer.name}</p>
                      <p className="text-sm text-gray-500">{formatDate(o.orderDate)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${showShip ? fb.className : STAGE_COLORS[o.status as OrderStage] ?? "bg-gray-100 text-gray-700"}`}>
                      {showShip ? fb.label : STAGE_LABELS[o.status as OrderStage] ?? o.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(total, o.currency)}</span>
                    <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
