"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/format";

type Values = {
  name?: string | null;
  kind?: string | null;
  unit?: string | null;
  costPrice?: number | null;
  currency?: string | null;
  reorderLevel?: number | null;
  hsnCode?: string | null;
  supplierId?: string | null;
  notes?: string | null;
};

const KINDS = [
  { value: "BASE_FABRIC", label: "Base fabric" },
  { value: "EMBELLISHMENT", label: "Embellishment (zari, beads, sequins)" },
  { value: "THREAD", label: "Thread" },
  { value: "OTHER", label: "Other" },
];

const UNITS = ["mtr", "kg", "g", "pcs", "cone", "roll"];

export default function MaterialForm({
  initial,
  suppliers,
  action,
  submitLabel,
}: {
  initial?: Values;
  suppliers: { id: string; name: string }[];
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await action(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5 p-4">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div>
        <label className="field-label" htmlFor="name">Material name *</label>
        <input id="name" name="name" required defaultValue={initial?.name ?? ""}
          className="field-input" placeholder="e.g. Silver Georgette 44&quot;" autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="kind">Type</label>
          <select id="kind" name="kind" defaultValue={initial?.kind ?? "BASE_FABRIC"} className="field-input">
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="unit">Unit</label>
          <input id="unit" name="unit" list="material-units" defaultValue={initial?.unit ?? "mtr"}
            className="field-input" placeholder="mtr" autoComplete="off" />
          <datalist id="material-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="field-label" htmlFor="costPrice">Cost / unit</label>
          <input id="costPrice" name="costPrice" type="number" step="any" min="0" inputMode="decimal"
            defaultValue={initial?.costPrice ?? ""} className="field-input" placeholder="e.g. 120" />
        </div>
        <div>
          <label className="field-label" htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue={initial?.currency ?? "INR"} className="field-input">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="reorderLevel">Low-stock at</label>
          <input id="reorderLevel" name="reorderLevel" type="number" step="any" min="0" inputMode="decimal"
            defaultValue={initial?.reorderLevel ?? ""} className="field-input" placeholder="e.g. 50" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="supplierId">Default supplier</label>
          <select id="supplierId" name="supplierId" defaultValue={initial?.supplierId ?? ""} className="field-input">
            <option value="">— none —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="hsnCode">HSN code</label>
          <input id="hsnCode" name="hsnCode" defaultValue={initial?.hsnCode ?? ""} className="field-input" placeholder="Optional" />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""} className="field-input" rows={2} placeholder="Anything to remember" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
