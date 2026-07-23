"use client";

import { useState, useTransition } from "react";
import { adjustStock } from "./actions";

export default function StockAdjust({ variantId, stockQty, unit }: { variantId: string; stockQty: number; unit: string }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [isPending, startTransition] = useTransition();

  function apply(sign: number) {
    const n = parseFloat(qty);
    if (isNaN(n) || n <= 0) return;
    startTransition(async () => {
      await adjustStock(variantId, sign * n);
      setQty("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">
        {stockQty} {unit} · adjust
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
      <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="Qty" autoFocus
        className="w-16 rounded-lg border-0 bg-gray-50 px-2 py-1 text-sm ring-1 ring-inset ring-gray-200 focus:outline-none" />
      <button type="button" disabled={isPending} onClick={() => apply(1)} className="rounded-lg bg-green-100 px-2 py-1 text-sm font-bold text-green-700">+</button>
      <button type="button" disabled={isPending} onClick={() => apply(-1)} className="rounded-lg bg-red-100 px-2 py-1 text-sm font-bold text-red-700">−</button>
    </div>
  );
}
