"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { formatQty } from "@/lib/format";

type Item = { id: string; label: string; available: number; unit: string };

export default function ReturnForm({
  items,
  action,
  buttonLabel,
  heading,
  availableLabel = "shipped",
  toastMessage,
}: {
  items: Item[];
  action: (lines: { itemId: string; qty: number }[]) => Promise<{ error?: string } | void>;
  buttonLabel: string;
  heading: string;
  availableLabel?: string;
  toastMessage: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function submit() {
    const lines = items
      .map((it) => ({ itemId: it.id, qty: parseFloat(qty[it.id] ?? "") || 0 }))
      .filter((l) => l.qty > 0);
    if (lines.length === 0) return toast("Enter a quantity", { kind: "error" });
    startTransition(async () => {
      const res = await action(lines);
      if (res?.error) return toast(res.error, { kind: "error" });
      setQty({}); setOpen(false);
      toast(toastMessage);
      router.refresh();
    });
  }

  const eligible = items.filter((it) => it.available > 0);
  if (eligible.length === 0) return null;

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full">{buttonLabel}</button>;
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900">{heading}</h3>
      <ul className="space-y-2">
        {eligible.map((it) => (
          <li key={it.id} className="rounded-xl bg-gray-50 p-3 ring-1 ring-inset ring-gray-100">
            <p className="text-sm font-medium text-gray-900">{it.label}</p>
            <p className="mb-2 text-xs text-gray-500">{formatQty(it.available)} {it.unit} {availableLabel}</p>
            <input
              value={qty[it.id] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))}
              type="number" inputMode="decimal" step="0.01" min="0" max={it.available}
              placeholder={`Qty (${it.unit})`}
              className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-primary flex-1">{isPending ? "Saving…" : "Confirm"}</button>
      </div>
    </div>
  );
}
