"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";

type Material = { id: string; name: string; unit: string };
type Entry = { materialId: string; qtyPerPiece: string };

export default function DefaultMaterialsEditor({
  title,
  hint,
  materials,
  initial,
  action,
}: {
  title: string;
  hint: string;
  materials: Material[];
  initial: { materialId: string; qtyPerPiece: number | null }[];
  action: (entries: { materialId: string; qtyPerPiece?: number | null }[]) => Promise<{ error?: string; ok?: boolean } | void>;
}) {
  const [rows, setRows] = useState<Entry[]>(initial.map((e) => ({ materialId: e.materialId, qtyPerPiece: e.qtyPerPiece != null ? String(e.qtyPerPiece) : "" })));
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function setRow(i: number, patch: Partial<Entry>) { setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); }
  function addRow() { setRows((rs) => [...rs, { materialId: materials[0]?.id ?? "", qtyPerPiece: "" }]); }
  function removeRow(i: number) { setRows((rs) => rs.filter((_, idx) => idx !== i)); }

  function save() {
    const entries = rows.filter((r) => r.materialId).map((r) => ({ materialId: r.materialId, qtyPerPiece: r.qtyPerPiece === "" ? null : Number(r.qtyPerPiece) }));
    // de-dupe by material
    const seen = new Set<string>();
    const unique = entries.filter((e) => (seen.has(e.materialId) ? false : (seen.add(e.materialId), true)));
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
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-400">None set.</p>}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5">
          <select value={r.materialId} onChange={(e) => setRow(i, { materialId: e.target.value })} className="field-input !h-9 !py-1 text-sm">
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="number" step="any" min="0" inputMode="decimal" value={r.qtyPerPiece} onChange={(e) => setRow(i, { qtyPerPiece: e.target.value })} className="field-input !h-9 !py-1 w-28 text-sm" placeholder="qty/pc (opt)" />
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
