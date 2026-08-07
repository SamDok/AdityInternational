"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/format";
import type { MaterialPoInput } from "./actions";

type Material = { id: string; name: string; unit: string };
type Line = { materialId: string; qtyOrdered: string; rate: string; gstRate: string; unit: string };

export default function MaterialPoForm({
  materials,
  suppliers,
  action,
  submitLabel,
}: {
  materials: Material[];
  suppliers: { id: string; name: string }[];
  action: (input: MaterialPoInput) => Promise<{ error?: string } | void>;
  submitLabel: string;
}) {
  const [vendorId, setVendorId] = useState(suppliers[0]?.id ?? "");
  const [currency, setCurrency] = useState("INR");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ materialId: materials[0]?.id ?? "", qtyOrdered: "", rate: "", gstRate: "", unit: materials[0]?.unit ?? "mtr" }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function onMaterialChange(i: number, materialId: string) {
    const m = materials.find((x) => x.id === materialId);
    setLine(i, { materialId, unit: m?.unit ?? "mtr" });
  }
  function addLine() {
    setLines((ls) => [...ls, { materialId: materials[0]?.id ?? "", qtyOrdered: "", rate: "", gstRate: "", unit: materials[0]?.unit ?? "mtr" }]);
  }
  function removeLine(i: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));
  }

  function submit() {
    setError(null);
    const items = lines
      .filter((l) => l.materialId && parseFloat(l.qtyOrdered) > 0)
      .map((l) => ({ materialId: l.materialId, qtyOrdered: Number(l.qtyOrdered), rate: l.rate === "" ? null : Number(l.rate), gstRate: l.gstRate === "" ? null : Number(l.gstRate), unit: l.unit }));
    if (!vendorId) { setError("Choose a supplier."); return; }
    if (items.length === 0) { setError("Add at least one material line with a quantity."); return; }
    startTransition(async () => {
      const res = await action({ vendorId, currency, issueDate, notes, items });
      if (res?.error) setError(res.error);
    });
  }

  if (materials.length === 0) {
    return (
      <div className="p-4">
        <div className="card text-sm text-gray-600">Add a material first, then raise a purchase order for it.
          <a href="/materials/new" className="ml-1 font-medium text-brand-600">Add material</a></div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Supplier</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="field-input">
            {suppliers.length === 0 && <option value="">No suppliers yet</option>}
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field-input">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="field-label">Order date</label>
        <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="field-input" />
      </div>

      <div className="space-y-2">
        <label className="field-label">Materials</label>
        {lines.map((l, i) => (
          <div key={i} className="card space-y-2">
            <select value={l.materialId} onChange={(e) => onMaterialChange(i, e.target.value)} className="field-input">
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input type="number" step="any" min="0" inputMode="decimal" value={l.qtyOrdered} onChange={(e) => setLine(i, { qtyOrdered: e.target.value })} className="field-input" placeholder={`Qty (${l.unit})`} />
              <input type="number" step="any" min="0" inputMode="decimal" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} className="field-input" placeholder="Rate/unit" />
              <input type="number" step="any" min="0" inputMode="decimal" value={l.gstRate} onChange={(e) => setLine(i, { gstRate: e.target.value })} className="field-input" placeholder="GST %" title="GST % paid on this input (for ITC refund)" />
              <button type="button" onClick={() => removeLine(i)} className="px-2 text-gray-400 hover:text-red-600" aria-label="Remove line">✕</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addLine} className="btn-secondary w-full">+ Add material</button>
      </div>

      <div>
        <label className="field-label">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="field-input" rows={2} placeholder="Optional" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-primary flex-1">{isPending ? "Saving…" : submitLabel}</button>
      </div>
    </div>
  );
}
