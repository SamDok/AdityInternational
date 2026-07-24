"use client";

import { useState, useTransition } from "react";
import { reduceShipment } from "./actions";
import { useToast } from "@/components/Toast";

// Correction control: reduce a line's shipped quantity by an amount (default =
// all of it), restoring that much stock.
export default function UnshipButton({ itemId, shippedQty, unit }: { itemId: string; shippedQty: number; unit: string }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(shippedQty));
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function submit() {
    const n = parseFloat(qty);
    if (isNaN(n) || n <= 0) return;
    startTransition(async () => {
      const res = await reduceShipment(itemId, n);
      setOpen(false);
      if (res?.error) toast(res.error, { kind: "error" });
      else toast(`Un-shipped ${Math.min(n, shippedQty)} ${unit} — stock restored`);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => { setQty(String(shippedQty)); setOpen(true); }} className="text-xs font-medium text-amber-600 hover:text-amber-700">
        Undo shipment
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        type="number" inputMode="decimal" step="0.01" min="0" max={shippedQty} autoFocus
        className="w-16 rounded-lg border-0 bg-gray-50 px-2 py-1 text-xs ring-1 ring-inset ring-gray-200 focus:outline-none"
      />
      <button type="button" disabled={isPending} onClick={submit} className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
        {isPending ? "…" : "Restore"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400">cancel</button>
    </span>
  );
}
