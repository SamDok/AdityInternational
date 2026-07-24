"use client";

import { useState, useTransition } from "react";
import { recordShipment } from "./actions";
import { useToast } from "@/components/Toast";

type Item = { id: string; label: string; quantity: number; shippedQty: number; unit: string; stockQty: number };

export default function ShipForm({ orderId, items }: { orderId: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  // Show a line if there's still something to ship, or stock on hand to send
  // (you can ship more than ordered, as long as it's in stock).
  const pendingItems = items.filter((it) => it.quantity - it.shippedQty > 1e-9 || it.stockQty > 1e-9);

  function submit() {
    setError(null);
    const lines = items
      .map((it) => {
        const ship = parseFloat(vals[it.id] ?? "");
        const weight = parseFloat(weights[it.id] ?? "");
        return { itemId: it.id, ship, weight: !isNaN(weight) && weight > 0 ? weight : null };
      })
      .filter((r) => !isNaN(r.ship) && r.ship > 0);
    if (lines.length === 0) return setError("Enter a quantity to ship.");
    startTransition(async () => {
      const res = await recordShipment(orderId, lines);
      if (res?.error) { setError(res.error); toast(res.error, { kind: "error" }); }
      else { setVals({}); setOpen(false); toast("Shipment recorded — stock reduced"); }
    });
  }

  if (pendingItems.length === 0) return null;

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full">Record shipment</button>;
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900">Record shipment</h3>
      <p className="text-xs text-gray-500">Enter how much is going out now — you can send more than ordered if it&apos;s in stock. This reduces stock and marks the line shipped.</p>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
      <ul className="space-y-2">
        {pendingItems.map((it) => {
          const remaining = Math.max(0, it.quantity - it.shippedQty);
          return (
            <li key={it.id} className="rounded-xl bg-gray-50 p-3 ring-1 ring-inset ring-gray-100">
              <p className="truncate text-sm font-medium text-gray-900">{it.label}</p>
              <p className="mb-2 text-xs text-gray-500">
                {it.shippedQty}/{it.quantity} {it.unit} shipped · {remaining} left · <span className={it.stockQty > 0 ? "text-gray-500" : "text-amber-600"}>{it.stockQty} in stock</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-gray-500">Ship ({it.unit})</span>
                  <input
                    value={vals[it.id] ?? ""}
                    onChange={(e) => setVals((v) => ({ ...v, [it.id]: e.target.value }))}
                    type="number" inputMode="decimal" step="0.01" min="0" placeholder={String(remaining || "")}
                    className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-gray-500">Weight (kg)</span>
                  <input
                    value={weights[it.id] ?? ""}
                    onChange={(e) => setWeights((v) => ({ ...v, [it.id]: e.target.value }))}
                    type="number" inputMode="decimal" step="0.01" min="0" placeholder="optional"
                    className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : "Ship & reduce stock"}
        </button>
      </div>
    </div>
  );
}
