import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Pager from "@/components/Pager";
import { formatDate } from "@/lib/format";
import { jobDocNo } from "@/lib/jobNumber";
import { ClipboardIcon, PlusIcon, ChevronRightIcon, DocumentIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-blue-100 text-blue-700" },
  PARTIAL: { label: "Partial", cls: "bg-amber-100 text-amber-700" },
  RECEIVED: { label: "Received", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

type View = "open" | "awaiting" | "done" | "all";

// A job-work job is "awaiting materials" while any of its design lines has had
// no materials issued yet — the kaarigar can't start that line until fabric goes out.
// Only a first stage (prevStageId null) needs materials issued — later production
// stages are labour only, so they never count as "awaiting materials".
const AWAITING_WHERE = { kind: "JOB_WORK", status: { in: ["OPEN", "PARTIAL"] }, prevStageId: null, items: { some: { materials: { none: {} } } } };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const sp = await searchParams;
  const view = (sp.view ?? "open") as View;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const PAGE_SIZE = 30;

  // The view maps straight onto the status column, so we filter + paginate in the DB.
  const statusWhere =
    view === "done" ? { status: "RECEIVED" }
    : view === "all" ? {}
    : view === "awaiting" ? AWAITING_WHERE
    : { status: { in: ["OPEN", "PARTIAL"] } };

  const [paged, filteredCount, openCount, awaitingCount, total] = await Promise.all([
    prisma.job.findMany({
      where: statusWhere,
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { vendor: true, items: { select: { materials: { select: { id: true }, take: 1 } } } },
    }),
    prisma.job.count({ where: statusWhere }),
    prisma.job.count({ where: { status: { in: ["OPEN", "PARTIAL"] } } }),
    prisma.job.count({ where: AWAITING_WHERE }),
    prisma.job.count(),
  ]);
  const tabs: [View, string][] = [
    ["open", `To receive${openCount ? ` (${openCount})` : ""}`],
    ["awaiting", `Awaiting materials${awaitingCount ? ` (${awaitingCount})` : ""}`],
    ["done", "Received"],
    ["all", "All"],
  ];

  return (
    <div>
      <PageHeader
        title="Production"
        subtitle={total ? `${total} job${total === 1 ? "" : "s"}` : undefined}
        action={<Link href="/jobs/new" aria-label="New job" className="btn-primary !px-3 !py-2"><PlusIcon className="h-5 w-5" /></Link>}
      />

      {/* Production hub — planning views alongside the jobs themselves */}
      <div className="grid grid-cols-2 gap-3 p-4 pb-0">
        <Link href="/schedule" className="card flex items-center gap-2 hover:bg-gray-50">
          <span className="text-lg">🗓️</span>
          <div className="min-w-0"><p className="text-sm font-semibold text-gray-900">Due soon</p><p className="truncate text-xs text-gray-500">deadlines &amp; risk</p></div>
        </Link>
        <Link href="/procurement" className="card flex items-center gap-2 hover:bg-gray-50">
          <DocumentIcon className="h-5 w-5 text-brand-500" />
          <div className="min-w-0"><p className="text-sm font-semibold text-gray-900">To procure</p><p className="truncate text-xs text-gray-500">what to make/buy</p></div>
        </Link>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<ClipboardIcon className="h-8 w-8" />}
          title="No jobs yet"
          message="Assign a design to a kaarigar (job work) or record a purchase from a supplier. Receiving adds stock in."
          actionLabel="Create your first job"
          actionHref="/jobs/new"
        />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto px-4 pt-3">
            {tabs.map(([value, label]) => (
              <Link key={value} href={value === "open" ? "/jobs" : `/jobs?view=${value}`}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${view === value ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-gray-50 text-gray-700 ring-gray-200"}`}>
                {label}
              </Link>
            ))}
          </div>

          {filteredCount === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">
              {view === "done" ? "Nothing fully received yet." : view === "open" ? "Nothing open — everything's received." : "No jobs here."}
            </p>
          ) : (
            <ul className="space-y-2 p-4">
              {paged.map((j) => {
                const s = STATUS[j.status] ?? { label: j.status, cls: "bg-gray-100 text-gray-700" };
                const canReceive = j.status === "OPEN" || j.status === "PARTIAL";
                const lineCount = j.items.length;
                const awaitingMaterials = j.kind === "JOB_WORK" && canReceive && j.items.some((it) => it.materials.length === 0);
                return (
                  <li key={j.id}>
                    <div className="card flex items-center gap-2">
                      <Link href={`/jobs/${j.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-gray-900">Job {jobDocNo(j)} · {j.vendor.name}</p>
                          <p className="truncate text-sm text-gray-500">
                            {j.kind === "PURCHASE" ? "Purchase" : "Job work"} · {formatDate(j.issueDate)} · {lineCount} line{lineCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                          {awaitingMaterials && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Awaiting materials</span>}
                        </div>
                        {!canReceive && <ChevronRightIcon className="h-5 w-5 text-gray-300" />}
                      </Link>
                      {canReceive && (
                        <Link href={`/jobs/${j.id}?receive=1`} className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white active:bg-green-700">
                          Receive
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Pager basePath="/jobs" params={{ view: view === "open" ? undefined : view }} page={page} pageSize={PAGE_SIZE} total={filteredCount} />
        </>
      )}
    </div>
  );
}
