"use client";

import { useState, useTransition } from "react";
import { createVariantsBulk } from "./actions";
import { PlusIcon, TrashIcon } from "@/components/Icons";

type Row = { key: string; width: string; colour: string; gsm: string; costPrice: string; salePrice: string; stockQty: string };

let counter = 0;
const emptyRow = (): Row => ({ key: `r${counter++}`, width: "", colour: "", gsm: "", costPrice: "", salePrice: "", stockQty: "" });

export default function BulkWidthsForm({ designId }: { designId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function submit() {
    setMsg(null);
    const filled = rows.filter((r) => r.width.trim());
    if (filled.length === 0) { setMsg("Enter at least one width."); return; }
    startTransition(async () => {
      const res = await createVariantsBulk(designId, filled);
      if (res?.error) setMsg(res.error);
      else {
        setMsg(`Added ${res?.created ?? 0}.`);
        setRows([emptyRow(), emptyRow(), emptyRow()]);
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full">
        <PlusIcon className="h-5 w-5" /> Add several widths at once
      </button>
    );
  }

  const cell = "w-24 rounded-lg border-0 bg-gray-50 px-2 py-1.5 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none";

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900">Add several widths</h3>
      {msg && <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400">
              <th className="px-1 pb-1">Width*</th><th className="px-1 pb-1">Colour</th><th className="px-1 pb-1">GSM</th>
              <th className="px-1 pb-1">Cost</th><th className="px-1 pb-1">Price</th><th className="px-1 pb-1">Stock</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="p-1"><input className={cell} value={r.width} onChange={(e) => update(r.key, { width: e.target.value })} placeholder='44"' /></td>
                <td className="p-1"><input className={cell} value={r.colour} onChange={(e) => update(r.key, { colour: e.target.value })} placeholder="Gold" /></td>
                <td className="p-1"><input className={cell} value={r.gsm} onChange={(e) => update(r.key, { gsm: e.target.value })} inputMode="decimal" /></td>
                <td className="p-1"><input className={cell} value={r.costPrice} onChange={(e) => update(r.key, { costPrice: e.target.value })} inputMode="decimal" /></td>
                <td className="p-1"><input className={cell} value={r.salePrice} onChange={(e) => update(r.key, { salePrice: e.target.value })} inputMode="decimal" /></td>
                <td className="p-1"><input className={cell} value={r.stockQty} onChange={(e) => update(r.key, { stockQty: e.target.value })} inputMode="decimal" /></td>
                <td className="p-1">
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))} className="rounded-lg p-1 text-red-500 hover:bg-red-50">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setRows((p) => [...p, emptyRow()])} className="text-sm font-medium text-brand-600">
        + Add row
      </button>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Close</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : "Save widths"}
        </button>
      </div>
    </div>
  );
}
