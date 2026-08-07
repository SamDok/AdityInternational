import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney, formatDate, formatQty } from "@/lib/format";
import { jobDocNo } from "@/lib/jobNumber";
import ReceiveForm from "../ReceiveForm";
import ReturnForm from "../../shipments/ReturnForm";
import ToggleButton from "../../products/ToggleButton";
import DeleteButton from "@/components/DeleteButton";
import JobMaterials from "../JobMaterials";
import NextStageForm from "../NextStageForm";
import { defaultMaterialsForDesign } from "@/lib/materials";
import { cancelJob, deleteJob, closeJobShort, recordRejection, setJobStageMode } from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-blue-100 text-blue-700" },
  PARTIAL: { label: "Partial", cls: "bg-amber-100 text-amber-700" },
  RECEIVED: { label: "Received", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ receive?: string }> }) {
  const { id } = await params;
  const { receive } = await searchParams;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      vendor: true,
      order: true,
      prevStage: { select: { id: true, number: true, seq: true, fyLabel: true, kind: true, stageNo: true, stageName: true, vendor: { select: { name: true } } } },
      nextStages: { where: { status: { not: "CANCELLED" } }, select: { id: true, number: true, seq: true, fyLabel: true, kind: true, stageNo: true, stageName: true, status: true, vendor: { select: { name: true } }, items: { select: { productId: true, qtyOrdered: true } } } },
      items: {
        include: {
          product: { include: { design: { select: { id: true } } } },
          materials: { include: { material: { select: { name: true, unit: true } } } },
        },
      },
    },
  });
  if (!job) notFound();

  // Multi-process: WIP here = received at this stage minus what's already been
  // forwarded to a next stage. An intermediate stage is one whose output goes to
  // another kaarigar (isFinalStage=false) rather than into sellable stock.
  const forwarded = new Map<string, number>();
  for (const ns of job.nextStages) for (const it of ns.items) forwarded.set(it.productId, (forwarded.get(it.productId) ?? 0) + it.qtyOrdered);
  const wip = job.items.reduce((s, it) => s + Math.max(0, it.qtyReceived - (forwarded.get(it.productId) ?? 0)), 0);
  const inRoute = !job.isFinalStage || job.prevStage != null || job.nextStages.length > 0;
  const stageVendors = !job.isFinalStage
    ? await prisma.vendor.findMany({ where: { archived: false, kind: { in: ["KAARIGAR", "BOTH"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  // Materials issued to the kaarigar are only relevant for job work.
  const showMaterials = job.kind === "JOB_WORK";
  const allMaterials = showMaterials
    ? await prisma.rawMaterial.findMany({ where: { archived: false }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, unit: true, stockQty: true } })
    : [];
  const materialLines = showMaterials
    ? await Promise.all(
        job.items.map(async (it) => ({
          jobItemId: it.id,
          label: it.product.name,
          orderedQty: it.qtyOrdered,
          issued: it.materials.map((m) => ({ id: m.id, name: m.material.name, unit: m.material.unit, qtyIssued: m.qtyIssued, qtyReturned: m.qtyReturned })),
          defaults: it.product.design ? await defaultMaterialsForDesign(it.product.design.id) : [],
        })),
      )
    : [];

  const docNo = jobDocNo(job);
  const s = STATUS[job.status] ?? { label: job.status, cls: "bg-gray-100 text-gray-700" };
  const total = job.items.reduce((sum, it) => sum + (it.rate ?? 0) * it.qtyOrdered, 0);
  const canReceive = job.status === "OPEN" || job.status === "PARTIAL";
  const anyReceived = job.items.some((it) => it.qtyReceived > 0);
  // A partly-received job the vendor won't finish can be closed short.
  const canCloseShort = job.status === "PARTIAL";

  return (
    <div>
      <PageHeader
        title={`Job ${docNo}`}
        subtitle={job.vendor.name}
        backHref="/jobs"
        action={
          <div className="flex gap-2">
            <Link href={`/po/${job.id}`} className="btn-secondary !px-4 !py-2 text-sm">Print</Link>
            {job.status !== "CANCELLED" && (
              <Link href={`/jobs/${job.id}/edit`} className="btn-secondary !px-4 !py-2 text-sm">Edit</Link>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-4">
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{job.kind === "PURCHASE" ? "Purchase" : "Job work"} · {formatDate(job.issueDate)}</p>
            {job.dueDate && <p className="text-sm text-gray-500">Expected by {formatDate(job.dueDate)}</p>}
            <p className="mt-1 text-sm">
              <Link href={`/vendors/${job.vendorId}`} className="font-medium text-brand-600 hover:underline">{job.vendor.name}</Link>
            </p>
            {job.order && (
              <p className="mt-1 text-sm text-gray-500">
                From <Link href={`/orders/${job.orderId}`} className="font-medium text-brand-600 hover:underline">order #{job.order.number}</Link>
              </p>
            )}
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${s.cls}`}>{s.label}</span>
        </div>

        {inRoute && (
          <div className="card space-y-2 bg-indigo-50/60">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-indigo-900">
                Production route · Stage {job.stageNo ?? 1}{job.stageName ? ` · ${job.stageName}` : ""}
              </p>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-indigo-700">
                {job.isFinalStage ? "Final → finished stock" : "Intermediate → next kaarigar"}
              </span>
            </div>
            {job.prevStage && (
              <p className="text-xs text-indigo-800">
                ← Previous: <Link href={`/jobs/${job.prevStage.id}`} className="font-semibold underline">{jobDocNo(job.prevStage)}</Link>
                {job.prevStage.stageName ? ` (${job.prevStage.stageName})` : ""} · {job.prevStage.vendor.name}
              </p>
            )}
            {job.nextStages.map((ns) => (
              <p key={ns.id} className="text-xs text-indigo-800">
                → Next: <Link href={`/jobs/${ns.id}`} className="font-semibold underline">{jobDocNo(ns)}</Link>
                {ns.stageName ? ` (${ns.stageName})` : ""} · {ns.vendor.name}
              </p>
            ))}
            {!job.isFinalStage && wip > 0 && (
              <p className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-indigo-900">
                Work-in-progress here: {formatQty(wip)} — received but not yet sent to the next stage.
              </p>
            )}
          </div>
        )}

        {canReceive && !job.isFinalStage && (
          <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
            This is an intermediate stage — what you receive here becomes work-in-progress (not sellable stock) and is sent to the next kaarigar.
          </p>
        )}

        {canReceive && (
          <ReceiveForm
            jobId={job.id}
            defaultOpen={receive === "1"}
            items={job.items.map((it) => ({ id: it.id, label: it.product.name, qtyOrdered: it.qtyOrdered, qtyReceived: it.qtyReceived, unit: it.unit, pieces: it.pieces, perPieceQty: it.perPieceQty, piecesReceived: it.piecesReceived }))}
          />
        )}

        {showMaterials && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Materials to issue</h2>
            <JobMaterials lines={materialLines} materials={allMaterials} disabled={job.status === "CANCELLED"} />
          </section>
        )}

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Items</h2>
          <ul className="space-y-2">
            {job.items.map((it) => (
              <li key={it.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {it.product.designId ? (
                        <Link href={`/products/design/${it.product.designId}`} className="hover:underline">{it.product.name}</Link>
                      ) : it.product.name}
                    </p>
                    {it.pieces && it.perPieceQty != null && (
                      <p className="mt-1 text-sm text-gray-500">{it.pieces} pcs × {formatQty(it.perPieceQty)} {it.unit} = {formatQty(it.qtyOrdered)} {it.unit}</p>
                    )}
                    <p className="mt-1 text-sm text-gray-500">
                      {it.pieces != null
                        ? `${it.piecesReceived}/${it.pieces} pcs received · ${formatQty(it.qtyReceived)} ${it.unit}`
                        : `${formatQty(it.qtyReceived)}/${formatQty(it.qtyOrdered)} ${it.unit} received`}
                      {it.weightReceived > 0 ? ` · ${formatQty(it.weightReceived)} kg` : ""}
                      {it.rate != null ? ` · ${formatMoney(it.rate, job.currency)}/${it.unit}` : ""}
                    </p>
                    {it.dueDate && <p className="mt-0.5 text-sm text-gray-500">Due by {formatDate(it.dueDate)}</p>}
                    {it.note && <p className="mt-0.5 text-sm text-gray-600">{it.note}</p>}
                  </div>
                  {it.rate != null && (
                    <p className="shrink-0 text-sm font-semibold text-gray-900">{formatMoney(it.rate * it.qtyOrdered, job.currency)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="card flex items-center justify-between">
          <span className="text-base font-semibold text-gray-700">Job value</span>
          <span className="text-xl font-bold text-gray-900">{formatMoney(total, job.currency)}</span>
        </div>

        {job.notes && (
          <section className="card">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="mt-1 text-sm text-gray-900">{job.notes}</p>
          </section>
        )}

        {job.status !== "CANCELLED" && anyReceived && (
          <ReturnForm
            items={job.items.map((it) => ({ id: it.id, label: it.product.name, available: it.qtyReceived, unit: it.unit }))}
            action={recordRejection.bind(null, job.id)}
            buttonLabel="Reject received goods (quality)"
            heading="Quality rejection — sending goods back"
            availableLabel="received"
            toastMessage="Rejection recorded — stock removed"
          />
        )}

        {!job.isFinalStage && wip > 0 && job.status !== "CANCELLED" && (
          <NextStageForm jobId={job.id} vendors={stageVendors} />
        )}

        <div className="space-y-2 pt-2">
          {job.kind === "JOB_WORK" && !anyReceived && job.status !== "CANCELLED" && (
            <ToggleButton
              action={setJobStageMode.bind(null, job.id, job.isFinalStage)}
              label={job.isFinalStage ? "Make this a multi-stage job (output goes to another kaarigar)" : "Output goes to finished stock instead"}
              toastMessage={job.isFinalStage ? "Marked as an intermediate stage" : "Marked as the final stage"}
            />
          )}
          {canCloseShort && (
            <ToggleButton action={closeJobShort.bind(null, job.id)} label="Close job (short-delivered)" toastMessage="Job closed" />
          )}
          {job.status !== "CANCELLED" && job.status !== "RECEIVED" && (
            <ToggleButton action={cancelJob.bind(null, job.id)} label="Cancel job" toastMessage="Job cancelled" />
          )}
          <DeleteButton action={deleteJob.bind(null, job.id)} label="Delete job" confirmMessage={`Delete job ${docNo}? Stock already received stays. This can't be undone.`} />
        </div>
      </div>
    </div>
  );
}
