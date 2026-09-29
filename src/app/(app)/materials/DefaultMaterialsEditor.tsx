"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";

type Material = { id: string; name: string; unit: string };
type Entry = { materialId: string; qtyPerPiece: string; stepName: string };

export default function DefaultMaterialsEditor({
  title,
  hint,
  materials,
  steps = [],
  initial,
  action,
}: {
  title: string;
  hint: string;
  materials: Material[];
  steps?: string[]; // production-route step names, if this design/type has a route
  initial: { materialId: string; qtyPerPiece: number | null; stepName?: string | null }[];
  action: (entries: { materialId: string; qtyPerPiece?: number | null; stepName?: string | null }[]) => Promise<{ error?: string; ok?: boolean } | void>;
}) {
  const [rows, setRows] = useState<Entry[]>(initial.map((e) => ({ materialId: e.materialId, qtyPerPiece: e.qtyPerPiece != null ? String(e.qtyPerPiece) : "", stepName: e.stepName ?? "" })));
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const hasSteps = steps.length > 0;

  function setRow(i: number, patch: Partial<Entry>) { setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); }
  function addRow() { setRows((rs) => [...rs, { materialId: materials[0]?.id ?? "", qtyPerPiece: "", stepName: "" }]); }
  function removeRow(i: number) { setRows((rs) => rs.filter((_, idx) => idx !== i)); }

  function save() {
    const entries = rows.filter((r) => r.materialId).map((r) => ({ materialId: r.materialId, qtyPerPiece: r.qtyPerPiece === "" ? null : Number(r.qtyPerPiece), stepName: r.stepName || null }));
    // de-dupe by material + step
    const seen = new Set<string>();
    const unique = entries.filter((e) => { const k = `${e.materialId}|${e.stepName ?? ""}`; return seen.has(k) ? false : (seen.add(k), true); });
    startTransition(async () => {
      const res = await action(unique);
      if (res?.error) { toast(res.error, { kind: "error" }); return; }
      toast("Default materials saved");
    });
  }

  if (materials.length === 0) {
    return (
      <div className="card">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">Add materials first, then set which ones this uses.
          <a href="/materials/new" className="ml-1 font-medium text-brand-600">Add material</a></p>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{hint}</p>
        {hasSteps && <p className="mt-0.5 text-xs text-indigo-500">This has a production route — tag each material with the step it&apos;s issued at, so each kaarigar&apos;s job pre-fills the right one. &quot;Any / bought&quot; is used on a plain single job.</p>}
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-400">None set.</p>}
      {rows.map((r, i) => (
        <div key={i} className={`grid items-center gap-1.5 ${hasSteps ? "grid-cols-[1fr_auto_auto_auto]" : "grid-cols-[1fr_auto_auto]"}`}>
          <select value={r.materialId} onChange={(e) => setRow(i, { materialId: e.target.value })} className="field-input !h-9 !py-1 text-sm">
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {hasSteps && (
            <select value={r.stepName} onChange={(e) => setRow(i, { stepName: e.target.value })} className="field-input !h-9 !py-1 w-28 text-sm">
              <option value="">Any / bought</option>
              {steps.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <input type="number" step="any" min="0" inputMode="decimal" value={r.qtyPerPiece} onChange={(e) => setRow(i, { qtyPerPiece: e.target.value })} className="field-input !h-9 !py-1 w-24 text-sm" placeholder="qty/pc" />
          <button type="button" onClick={() => removeRow(i)} className="px-1.5 text-gray-400 hover:text-red-600" aria-label="Remove">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" onClick={addRow} className="btn-secondary flex-1 !py-2 text-sm">+ Add material</button>
        <button type="button" disabled={isPending} onClick={save} className="btn-primary flex-1 !py-2 text-sm">{isPending ? "Saving…" : "Save defaults"}</button>
      </div>
    </div>
  );
}
