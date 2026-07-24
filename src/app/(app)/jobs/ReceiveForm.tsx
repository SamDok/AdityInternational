"use client";

import { useState, useTransition } from "react";
import { receiveJob } from "./actions";
import { useToast } from "@/components/Toast";

type Item = {
  id: string;
  label: string;
  qtyOrdered: number;
  qtyReceived: number;
  unit: string;
  pieces: number | null;
  perPieceQty: number | null;
  piecesReceived: number;
};

type Row = { pieces: string; meters: string; weight: string };
const emptyRow = (): Row => ({ pieces: "", meters: "", weight: "" });

export default function ReceiveForm({ jobId, items }: { jobId: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const rowOf = (id: string) => rows[id] ?? emptyRow();
  const setField = (id: string, k: keyof Row, v: string) =>
    setRows((r) => ({ ...r, [id]: { ...rowOf(id), [k]: v } }));

  function submit() {
    setError(null);
    const receipts = items
      .map((it) => {
        const row = rowOf(it.id);
        const pieces = parseInt(row.pieces, 10);
        const meters = parseFloat(row.meters);
        const weight = parseFloat(row.weight);
        return {
          itemId: it.id,
          pieces: !isNaN(pieces) && pieces > 0 ? pieces : null,
          meters: !isNaN(meters) && meters > 0 ? meters : 0,
          weight: !isNaN(weight) && weight > 0 ? weight : null,
        };
      })
      .filter((r) => r.meters > 0 || (r.pieces ?? 0) > 0 || r.weight != null);
    if (receipts.length === 0) return setError("Enter what you received.");
    startTransition(async () => {
      const res = await receiveJob(jobId, receipts);
      if (res?.error) { setError(res.error); toast(res.error, { kind: "error" }); }
      else { setRows({}); setOpen(false); toast("Received — added to stock"); }
    });
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full">Receive goods</button>;
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900">Receive goods</h3>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
      <ul className="space-y-3">
        {items.map((it) => {
          const row = rowOf(it.id);
          const pieceWise = it.pieces != null;
          const pendingPcs = pieceWise ? Math.max(0, it.pieces! - it.piecesReceived) : 0;
          const pendingMtr = Math.max(0, it.qtyOrdered - it.qtyReceived);
          const nominalPer = it.perPieceQty ?? null;
          // Hint the likely metres from the pieces just entered × nominal per-piece.
          const enteredPcs = parseInt(row.pieces, 10);
          const metresHint = pieceWise && nominalPer && enteredPcs > 0 ? String(enteredPcs * nominalPer) : String(pendingMtr || "");
          return (
            <li key={it.id} className="rounded-xl bg-gray-50 p-3 ring-1 ring-inset ring-gray-100">
              <p className="text-sm font-medium text-gray-900">{it.label}</p>
              <p className="mb-2 text-xs text-gray-500">
                {pieceWise
                  ? `${it.piecesReceived}/${it.pieces} pcs in · ${pendingPcs} pending`
                  : `${it.qtyReceived}/${it.qtyOrdered} ${it.unit} in · ${pendingMtr} pending`}
              </p>
              <div className={`grid ${pieceWise ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                {pieceWise && (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-gray-500">Pieces</span>
                    <input value={row.pieces} onChange={(e) => setField(it.id, "pieces", e.target.value)}
                      type="number" inputMode="numeric" step="1" min="0" placeholder={String(pendingPcs || "")}
                      className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-gray-500">Metres ({it.unit})</span>
                  <input value={row.meters} onChange={(e) => setField(it.id, "meters", e.target.value)}
                    type="number" inputMode="decimal" step="0.01" min="0" placeholder={metresHint}
                    className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-gray-500">Weight (kg)</span>
                  <input value={row.weight} onChange={(e) => setField(it.id, "weight", e.target.value)}
                    type="number" inputMode="decimal" step="0.01" min="0" placeholder="optional"
                    className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                </label>
              </div>
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
