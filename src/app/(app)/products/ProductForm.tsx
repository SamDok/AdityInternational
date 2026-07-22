"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, UNITS } from "@/lib/format";

type ProductValues = {
  name?: string | null;
  sku?: string | null;
  description?: string | null;
  unit?: string | null;
  salePrice?: number | null;
  currency?: string | null;
  stockQty?: number | null;
};

type Props = {
  initial?: ProductValues;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitLabel: string;
};

export default function ProductForm({ initial, action, submitLabel }: Props) {
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
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="name">Product name *</label>
        <input id="name" name="name" required defaultValue={initial?.name ?? ""}
          className="field-input" placeholder="e.g. Cotton Twill 60&quot;" autoFocus />
      </div>

      <div>
        <label className="field-label" htmlFor="sku">Item code</label>
        <input id="sku" name="sku" defaultValue={initial?.sku ?? ""}
          className="field-input" placeholder="Internal code (optional)" />
      </div>

      <div>
        <label className="field-label" htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ""}
          className="field-input" rows={2} placeholder="Colour, quality, spec…" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="salePrice">Sale price</label>
          <input id="salePrice" name="salePrice" type="number" step="0.01" min="0"
            defaultValue={initial?.salePrice ?? 0} className="field-input" placeholder="0.00" inputMode="decimal" />
        </div>
        <div>
          <label className="field-label" htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue={initial?.currency ?? "INR"} className="field-input">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="stockQty">Stock on hand</label>
          <input id="stockQty" name="stockQty" type="number" step="0.01"
            defaultValue={initial?.stockQty ?? 0} className="field-input" placeholder="0" inputMode="decimal" />
        </div>
        <div>
          <label className="field-label" htmlFor="unit">Unit</label>
          <select id="unit" name="unit" defaultValue={initial?.unit ?? "mtr"} className="field-input">
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
