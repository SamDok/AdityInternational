"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receiveMaterialPo } from "../actions";
import { useToast } from "@/components/Toast";

type Item = { id: string; name: string; unit: string; qtyOrdered: number; qtyReceived: number };

export default function ReceiveMaterials({ poId, items }: { poId: string; items: Item[] }) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function submit() {
    const receipts = items
      .map((it) => ({ itemId: it.id, qty: parseFloat(qty[it.id] ?? "") }))
      .filter((r) => Number.isFinite(r.qty) && r.qty > 0);
    if (receipts.length === 0) { toast("Enter what you received", { kind: "error" }); return; }
    startTransition(async () => {
      const res = await receiveMaterialPo(poId, receipts);
      if (res?.error) { toast(res.error, { kind: "error" }); return; }
      toast("Received into stock");
      setQty({});
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3">
      <p className="text-sm font-semibold text-gray-900">Receive into stock</p>
      {items.map((it) => {
        const outstanding = Math.max(0, it.qtyOrdered - it.qtyReceived);
        return (
          <div key={it.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800">{it.name}</p>
              <p className="text-xs text-gray-400">{it.qtyReceived} / {it.qtyOrdered} {it.unit} · {outstanding} left</p>
            </div>
            <input
              type="number" step="any" min="0" inputMode="decimal"
              value={qty[it.id] ?? ""}
              onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))}
              className="field-input w-28" placeholder={`+ ${it.unit}`}
            />
          </div>
        );
      })}
      <button type="button" onClick={submit} disabled={isPending} className="btn-primary w-full">{isPending ? "Saving…" : "Receive"}</button>
    </div>
  );
}
