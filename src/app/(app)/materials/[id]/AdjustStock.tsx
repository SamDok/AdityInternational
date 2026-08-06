"use client";

import { useState, useTransition } from "react";
import { adjustMaterialStock } from "../actions";
import { useToast } from "@/components/Toast";

export default function AdjustStock({ id, unit }: { id: string; unit: string }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function submit(sign: 1 | -1) {
    const n = parseFloat(qty);
    if (!Number.isFinite(n) || n <= 0) { toast("Enter a quantity", { kind: "error" }); return; }
    startTransition(async () => {
      const res = await adjustMaterialStock(id, sign * n, note.trim() || undefined);
      if (res?.error) { toast(res.error, { kind: "error" }); return; }
      toast("Stock updated");
      setQty(""); setNote(""); setOpen(false);
    });
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full">Adjust stock</button>;
  }
  return (
    <div className="card space-y-3">
      <p className="text-sm font-semibold text-gray-900">Adjust stock</p>
      <div className="grid grid-cols-2 gap-3">
        <input type="number" step="any" min="0" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="field-input" placeholder={`Qty (${unit})`} autoFocus />
        <input value={note} onChange={(e) => setNote(e.target.value)} className="field-input" placeholder="Reason (optional)" />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={isPending} onClick={() => submit(1)} className="btn-primary flex-1">+ Add</button>
        <button type="button" disabled={isPending} onClick={() => submit(-1)} className="btn-secondary flex-1">− Remove</button>
        <button type="button" disabled={isPending} onClick={() => setOpen(false)} className="btn-secondary">Close</button>
      </div>
    </div>
  );
}
