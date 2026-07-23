"use client";

import { useState, useTransition } from "react";
import { receiveJob } from "./actions";

type Item = { id: string; label: string; qtyOrdered: number; qtyReceived: number; unit: string };

export default function ReceiveForm({ jobId, items }: { jobId: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const receipts = items
      .map((it) => ({ itemId: it.id, received: parseFloat(vals[it.id] ?? "") }))
      .filter((r) => !isNaN(r.received) && r.received > 0);
    if (receipts.length === 0) return setError("Enter a quantity to receive.");
    startTransition(async () => {
      const res = await receiveJob(jobId, receipts);
      if (res?.error) setError(res.error);
      else { setVals({}); setOpen(false); }
    });
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full">Receive goods</button>;
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900">Receive goods</h3>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
      <ul className="space-y-2">
        {items.map((it) => {
          const pending = Math.max(0, it.qtyOrdered - it.qtyReceived);
          return (
            <li key={it.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{it.label}</p>
                <p className="text-xs text-gray-500">{it.qtyReceived}/{it.qtyOrdered} {it.unit} received · {pending} pending</p>
              </div>
              <input
                value={vals[it.id] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [it.id]: e.target.value }))}
                type="number" inputMode="decimal" step="0.01" min="0" placeholder={String(pending || "")}
                className="w-24 rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : "Add to stock"}
        </button>
      </div>
    </div>
  );
}
