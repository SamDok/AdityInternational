"use client";

import { useState, useTransition } from "react";
import { receiveJob } from "./actions";
import { useToast } from "@/components/Toast";

type Item = { id: string; label: string; qtyOrdered: number; qtyReceived: number; unit: string; pieces: number | null; perPieceQty: number | null };

// A piece-wise line is received in pieces (converted to the base total for stock);
// a loose line is received in its unit as before.
function pieceWise(it: Item): number | null {
  return it.pieces != null && it.perPieceQty != null && it.perPieceQty > 0 ? it.perPieceQty : null;
}

export default function ReceiveForm({ jobId, items }: { jobId: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function submit() {
    setError(null);
    const receipts = items
      .map((it) => {
        const entered = parseFloat(vals[it.id] ?? "");
        if (isNaN(entered) || entered <= 0) return null;
        const per = pieceWise(it);
        // Convert pieces → base total for piece-wise lines; loose stays as-is.
        return { itemId: it.id, received: per ? entered * per : entered };
      })
      .filter((r): r is { itemId: string; received: number } => r != null);
    if (receipts.length === 0) return setError("Enter a quantity to receive.");
    startTransition(async () => {
      const res = await receiveJob(jobId, receipts);
      if (res?.error) { setError(res.error); toast(res.error, { kind: "error" }); }
      else { setVals({}); setOpen(false); toast("Received — added to stock"); }
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
          const per = pieceWise(it);
          const pendingBase = Math.max(0, it.qtyOrdered - it.qtyReceived);
          if (per) {
            // Piece-wise: show and enter pieces.
            const pendingPcs = Math.round((pendingBase / per) * 100) / 100;
            const recvPcs = Math.round((it.qtyReceived / per) * 100) / 100;
            const orderPcs = Math.round((it.qtyOrdered / per) * 100) / 100;
            const entered = parseFloat(vals[it.id] ?? "");
            return (
              <li key={it.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{it.label}</p>
                  <p className="text-xs text-gray-500">
                    {recvPcs}/{orderPcs} pcs received · {pendingPcs} pending
                    {!isNaN(entered) && entered > 0 && <span className="text-gray-400"> · = {entered * per} {it.unit}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    value={vals[it.id] ?? ""}
                    onChange={(e) => setVals((v) => ({ ...v, [it.id]: e.target.value }))}
                    type="number" inputMode="decimal" step="1" min="0" placeholder={String(pendingPcs || "")}
                    className="w-20 rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">pcs</span>
                </div>
              </li>
            );
          }
          return (
            <li key={it.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{it.label}</p>
                <p className="text-xs text-gray-500">{it.qtyReceived}/{it.qtyOrdered} {it.unit} received · {pendingBase} pending</p>
              </div>
              <input
                value={vals[it.id] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [it.id]: e.target.value }))}
                type="number" inputMode="decimal" step="0.01" min="0" placeholder={String(pendingBase || "")}
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
