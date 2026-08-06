"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueJobMaterials, returnJobMaterial } from "./actions";
import { useToast } from "@/components/Toast";
import { formatQty } from "@/lib/format";

type Material = { id: string; name: string; unit: string; stockQty: number };
type Issued = { id: string; name: string; unit: string; qtyIssued: number; qtyReturned: number };
type DefaultMat = { materialId: string; name: string; unit: string; kind: string; qtyPerPiece: number | null };
type Line = { jobItemId: string; label: string; orderedQty: number; issued: Issued[]; defaults: DefaultMat[] };
type Row = { materialId: string; qty: string };

export default function JobMaterials({ lines, materials, disabled }: { lines: Line[]; materials: Material[]; disabled: boolean }) {
  return (
    <div className="space-y-3">
      {lines.map((line) => <LinePanel key={line.jobItemId} line={line} materials={materials} disabled={disabled} />)}
    </div>
  );
}

function LinePanel({ line, materials, disabled }: { line: Line; materials: Material[]; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [returning, setReturning] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const stockOf = new Map(materials.map((m) => [m.id, m.stockQty]));

  function startIssue() {
    // Pre-fill from the design's default materials (base fabric qty = ordered metres).
    const prefill: Row[] = line.defaults.length
      ? line.defaults.map((d) => ({ materialId: d.materialId, qty: d.kind === "BASE_FABRIC" ? String(line.orderedQty || "") : (d.qtyPerPiece ? String(d.qtyPerPiece) : "") }))
      : [{ materialId: materials[0]?.id ?? "", qty: "" }];
    setRows(prefill);
    setOpen(true);
  }
  function setRow(i: number, patch: Partial<Row>) { setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); }
  function addRow() { setRows((rs) => [...rs, { materialId: materials[0]?.id ?? "", qty: "" }]); }
  function removeRow(i: number) { setRows((rs) => rs.filter((_, idx) => idx !== i)); }

  function issue() {
    const payload = rows.filter((r) => r.materialId && parseFloat(r.qty) > 0).map((r) => ({ materialId: r.materialId, qty: Number(r.qty) }));
    if (payload.length === 0) { toast("Enter what you're issuing", { kind: "error" }); return; }
    startTransition(async () => {
      const res = await issueJobMaterials(line.jobItemId, payload);
      if (res?.error) { toast(res.error, { kind: "error" }); return; }
      toast("Materials issued");
      setOpen(false); setRows([]);
      router.refresh();
    });
  }

  function doReturn(jmId: string, max: number, unit: string) {
    const n = parseFloat(returning[jmId] ?? "");
    if (!Number.isFinite(n) || n <= 0) { toast("Enter a quantity", { kind: "error" }); return; }
    startTransition(async () => {
      const res = await returnJobMaterial(jmId, n);
      if (res?.error) { toast(res.error, { kind: "error" }); return; }
      toast("Returned to stock");
      setReturning((s) => ({ ...s, [jmId]: "" }));
      router.refresh();
    });
  }

  const nothingIssued = line.issued.length === 0;

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-gray-900">{line.label}</p>
        {nothingIssued && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Materials pending</span>}
      </div>

      {line.issued.length > 0 && (
        <ul className="space-y-1">
          {line.issued.map((m) => {
            const used = m.qtyIssued - m.qtyReturned;
            return (
              <li key={m.id} className="rounded-lg bg-gray-50 px-2.5 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800">{m.name}</span>
                  <span className="text-gray-600">issued {formatQty(m.qtyIssued)}{m.qtyReturned ? ` · returned ${formatQty(m.qtyReturned)}` : ""} · <b>used {formatQty(used)}</b> {m.unit}</span>
                </div>
                {!disabled && used > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input type="number" step="any" min="0" inputMode="decimal" value={returning[m.id] ?? ""} onChange={(e) => setReturning((s) => ({ ...s, [m.id]: e.target.value }))} className="field-input !h-8 !py-1 w-24 text-xs" placeholder={`return ${m.unit}`} />
                    <button type="button" disabled={isPending} onClick={() => doReturn(m.id, used, m.unit)} className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">Return</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!disabled && !open && (
        <button type="button" onClick={startIssue} className="btn-secondary w-full !py-2 text-sm">Issue materials</button>
      )}

      {!disabled && open && (
        <div className="space-y-2 rounded-lg bg-gray-50 p-2">
          {rows.map((r, i) => {
            const onHand = stockOf.get(r.materialId);
            const over = onHand != null && parseFloat(r.qty) > onHand;
            return (
              <div key={i} className="space-y-1">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5">
                  <select value={r.materialId} onChange={(e) => setRow(i, { materialId: e.target.value })} className="field-input !h-9 !py-1 text-sm">
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input type="number" step="any" min="0" inputMode="decimal" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} className="field-input !h-9 !py-1 w-24 text-sm" placeholder="qty" />
                  <button type="button" onClick={() => removeRow(i)} className="px-1.5 text-gray-400 hover:text-red-600" aria-label="Remove">✕</button>
                </div>
                {onHand != null && (
                  <p className={`px-1 text-[11px] ${over ? "text-red-600" : "text-gray-400"}`}>on hand: {formatQty(onHand)}{over ? " — more than in stock" : ""}</p>
                )}
              </div>
            );
          })}
          <button type="button" onClick={addRow} className="w-full rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100">+ Add material</button>
          <div className="flex gap-2 pt-1">
            <button type="button" disabled={isPending} onClick={issue} className="btn-primary flex-1 !py-2 text-sm">{isPending ? "Issuing…" : "Issue"}</button>
            <button type="button" disabled={isPending} onClick={() => setOpen(false)} className="btn-secondary !py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
