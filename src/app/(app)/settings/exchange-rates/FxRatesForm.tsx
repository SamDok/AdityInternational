"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFxRates } from "../actions";
import { useToast } from "@/components/Toast";

const CURRENCIES = ["USD", "EUR", "GBP", "AED"];

export default function FxRatesForm({ initial }: { initial: Record<string, number> }) {
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(CURRENCIES.map((c) => [c, initial[c] != null ? String(initial[c]) : ""])),
  );
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function save() {
    const entries = CURRENCIES.map((c) => ({ currency: c, perUnitInr: parseFloat(rates[c] ?? "") || 0 }));
    startTransition(async () => {
      const res = await setFxRates(entries);
      if (res?.error) { toast(res.error, { kind: "error" }); return; }
      toast("Exchange rates saved");
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3">
      <p className="text-sm text-gray-600">How many rupees is 1 unit of each currency worth? Used to show an estimated margin on export orders (INR costs vs foreign sale).</p>
      {CURRENCIES.map((c) => (
        <div key={c} className="flex items-center gap-3">
          <span className="w-14 text-sm font-semibold text-gray-800">1 {c}</span>
          <span className="text-gray-400">=</span>
          <input
            type="number" step="any" min="0" inputMode="decimal"
            value={rates[c] ?? ""}
            onChange={(e) => setRates((r) => ({ ...r, [c]: e.target.value }))}
            className="field-input flex-1" placeholder={`₹ per ${c}`}
          />
          <span className="text-sm text-gray-500">₹</span>
        </div>
      ))}
      <button type="button" onClick={save} disabled={isPending} className="btn-primary w-full">{isPending ? "Saving…" : "Save rates"}</button>
    </div>
  );
}
