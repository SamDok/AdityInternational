import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { dueSoonSchedule, type ScheduleItem } from "../orders/schedule";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { overdue, behind, soon } = await dueSoonSchedule();
  const empty = overdue.length + behind.length + soon.length === 0;

  return (
    <div>
      <PageHeader title="Due soon" subtitle="Deliveries that need attention, and what's blocking them" backHref="/more" />

      <div className="space-y-6 p-4">
        {empty ? (
          <div className="rounded-xl bg-green-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-green-700">You&apos;re on track 🎉</p>
            <p className="mt-1 text-xs text-green-600">Nothing overdue, behind, or due in the next 7 days.</p>
          </div>
        ) : (
          <>
            <Section title="Overdue" tone="red" items={overdue} note="Past the delivery date and not fully shipped." />
            <Section title="Behind schedule" tone="orange" items={behind} note="You're past the start-by date for these — act now to stay on time." />
            <Section title="Coming up" tone="amber" items={soon} note="Due within the next 7 days (or the making needs starting)." />
          </>
        )}
      </div>
    </div>
  );
}

const TONES = {
  red: { head: "text-red-700", dot: "bg-red-500" },
  orange: { head: "text-orange-700", dot: "bg-orange-500" },
  amber: { head: "text-amber-700", dot: "bg-amber-500" },
} as const;

function Section({ title, tone, items, note }: { title: string; tone: keyof typeof TONES; items: ScheduleItem[]; note: string }) {
  if (items.length === 0) return null;
  const t = TONES[tone];
  return (
    <section>
      <h2 className={`mb-1 flex items-center gap-2 px-1 text-sm font-semibold ${t.head}`}>
        <span className={`h-2 w-2 rounded-full ${t.dot}`} />
        {title} · {items.length}
      </h2>
      <p className="mb-2 px-1 text-xs text-gray-400">{note}</p>
      <ul className="space-y-2">
        {items.map((it, i) => <Item key={it.orderId + it.productName + i} it={it} />)}
      </ul>
    </section>
  );
}

function Item({ it }: { it: ScheduleItem }) {
  return (
    <li className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/orders/${it.orderId}`} className="font-semibold text-brand-600 hover:underline">
            Order #{it.orderNumber} · {it.customerName}
          </Link>
          <p className="truncate text-sm text-gray-700">{it.productName}</p>
          <p className="text-xs text-gray-500">{it.remaining} {it.unit} to deliver · due {formatDate(it.deliveryDate)}</p>
          <Readiness it={it} />
        </div>
      </div>
    </li>
  );
}

function Readiness({ it }: { it: ScheduleItem }) {
  if (it.readiness === "READY") {
    return <p className="mt-1 text-xs font-medium text-green-600">✓ Ready to ship — just dispatch it</p>;
  }
  if (it.readiness === "MAKING") {
    return (
      <p className={`mt-1 text-xs font-medium ${it.jobLate ? "text-red-600" : "text-amber-600"}`}>
        Being made{it.jobNumber ? <> · <Link href={`/jobs/${it.jobId}`} className="underline">Job #{it.jobNumber}</Link></> : ""}
        {it.jobDueDate ? ` due ${formatDate(it.jobDueDate)}` : ""}
        {it.jobLate ? " — arrives after the deadline" : ""}
      </p>
    );
  }
  // NOT_PROCURED
  return (
    <p className="mt-1 text-xs font-medium text-red-600">
      Not procured yet{it.startBy ? ` — needed to start by ${formatDate(it.startBy)}` : ""}
      {it.leadDays != null ? ` (${it.leadDays}-day lead)` : ""}
    </p>
  );
}
