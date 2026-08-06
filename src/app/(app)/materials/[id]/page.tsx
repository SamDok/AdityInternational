import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatQty, formatMoney, formatDate } from "@/lib/format";
import DeleteButton from "@/components/DeleteButton";
import AdjustStock from "./AdjustStock";
import { deleteMaterial } from "../actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { BASE_FABRIC: "Base fabric", EMBELLISHMENT: "Embellishment", THREAD: "Thread", OTHER: "Other" };
const REASON_LABEL: Record<string, string> = {
  PURCHASE: "Purchased", ISSUE_TO_JOB: "Issued to job", RETURN_FROM_JOB: "Returned from job", MANUAL_ADJUST: "Manual adjust",
};

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await prisma.rawMaterial.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      movements: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!material) notFound();

  const low = material.reorderLevel != null && material.stockQty <= material.reorderLevel;

  return (
    <div>
      <PageHeader
        title={material.name}
        subtitle={`${KIND_LABEL[material.kind] ?? material.kind}${material.code ? ` · ${material.code}` : ""}`}
        backHref="/materials"
        action={<Link href={`/materials/${id}/edit`} className="btn-secondary !px-3 !py-2">Edit</Link>}
      />

      <div className="space-y-4 p-4">
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">In stock</p>
            <p className={`text-2xl font-bold ${low ? "text-red-600" : "text-gray-900"}`}>{formatQty(material.stockQty)} <span className="text-base font-medium text-gray-500">{material.unit}</span></p>
          </div>
          <div className="text-right text-sm text-gray-500">
            {material.costPrice != null && <p>{formatMoney(material.costPrice, material.currency)}/{material.unit}</p>}
            {material.reorderLevel != null && <p>Low at {formatQty(material.reorderLevel)}</p>}
            {material.supplier && <p><Link href={`/vendors/${material.supplier.id}`} className="text-brand-600">{material.supplier.name}</Link></p>}
          </div>
        </div>

        <AdjustStock id={id} unit={material.unit} />

        {material.notes && <div className="card text-sm text-gray-600">{material.notes}</div>}

        <div>
          <p className="mb-2 px-1 text-sm font-semibold text-gray-500">Movements</p>
          {material.movements.length === 0 ? (
            <p className="card text-sm text-gray-400">No stock movements yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {material.movements.map((mv) => (
                <li key={mv.id} className="card flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{REASON_LABEL[mv.reason] ?? mv.reason}</p>
                    <p className="text-xs text-gray-400">{formatDate(mv.createdAt)}{mv.note ? ` · ${mv.note}` : ""}</p>
                  </div>
                  <span className={`text-sm font-semibold ${mv.delta >= 0 ? "text-green-700" : "text-gray-700"}`}>
                    {mv.delta >= 0 ? "+" : ""}{formatQty(mv.delta)} {material.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-2">
          <DeleteButton action={deleteMaterial.bind(null, id)} label="Delete material" confirmMessage="Delete this material? This can't be undone." />
        </div>
      </div>
    </div>
  );
}
