"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, UNITS } from "@/lib/format";

type Values = {
  width?: string | null;
  gsm?: number | null;
  costPrice?: number | null;
  salePrice?: number | null;
  currency?: string | null;
  stockQty?: number | null;
  unit?: string | null;
  sku?: string | null;
};

type Props = {
  initial?: Values;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitLabel: string;
};

export default function VariantForm({ initial, action, submitLabel }: Props) {
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

  const num = (v?: number | null) => (v === null || v === undefined ? "" : String(v));

  return (
    <form action={onSubmit} className="space-y-5 p-4">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="width">Width *</label>
          <input id="width" name="width" required list="width-options" defaultValue={initial?.width ?? ""}
            className="field-input" placeholder='e.g. 44"' autoFocus />
          <datalist id="width-options">
            <option value={'44"'} /><option value={'54"'} /><option value={'58"'} /><option value={'60"'} />
            <option value="110 cm" /><option value="140 cm" /><option value="150 cm" />
          </datalist>
        </div>
        <div>
          <label className="field-label" htmlFor="gsm">GSM</label>
          <input id="gsm" name="gsm" type="number" step="0.01" min="0" inputMode="decimal"
            defaultValue={num(initial?.gsm)} className="field-input" placeholder="Weight" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="costPrice">Cost price</label>
          <input id="costPrice" name="costPrice" type="number" step="0.01" min="0" inputMode="decimal"
            defaultValue={num(initial?.costPrice)} className="field-input" placeholder="What it costs us" />
        </div>
        <div>
          <label className="field-label" htmlFor="salePrice">Sale price</label>
          <input id="salePrice" name="salePrice" type="number" step="0.01" min="0" inputMode="decimal"
            defaultValue={initial?.salePrice ?? 0} className="field-input" placeholder="0.00" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue={initial?.currency ?? "INR"} className="field-input">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="unit">Unit</label>
          <select id="unit" name="unit" defaultValue={initial?.unit ?? "mtr"} className="field-input">
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="stockQty">Stock on hand</label>
          <input id="stockQty" name="stockQty" type="number" step="0.01" inputMode="decimal"
            defaultValue={initial?.stockQty ?? 0} className="field-input" placeholder="0" />
        </div>
        <div>
          <label className="field-label" htmlFor="sku">Barcode / code</label>
          <input id="sku" name="sku" defaultValue={initial?.sku ?? ""} className="field-input" placeholder="Optional" />
        </div>
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
