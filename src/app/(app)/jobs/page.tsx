import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { ClipboardIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-blue-100 text-blue-700" },
  PARTIAL: { label: "Partial", cls: "bg-amber-100 text-amber-700" },
  RECEIVED: { label: "Received", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    orderBy: { issueDate: "desc" },
    include: { vendor: true, _count: { select: { items: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle={jobs.length ? `${jobs.length} total` : undefined}
        backHref="/more"
        action={<Link href="/jobs/new" aria-label="New job" className="btn-primary !px-3 !py-2"><PlusIcon className="h-5 w-5" /></Link>}
      />
      {jobs.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon className="h-8 w-8" />}
          title="No jobs yet"
          message="Assign a design to a kaarigar (job work) or record a purchase from a supplier. Receiving adds stock in."
          actionLabel="Create your first job"
          actionHref="/jobs/new"
        />
      ) : (
        <ul className="space-y-2 p-4">
          {jobs.map((j) => {
            const s = STATUS[j.status] ?? { label: j.status, cls: "bg-gray-100 text-gray-700" };
            return (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="card flex items-center gap-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">Job #{j.number} · {j.vendor.name}</p>
                    <p className="truncate text-sm text-gray-500">
                      {j.kind === "PURCHASE" ? "Purchase" : "Job work"} · {formatDate(j.issueDate)} · {j._count.items} line{j._count.items !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
