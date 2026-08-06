"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFxRates, refreshFxRatesNow } from "../actions";
import { useToast } from "@/components/Toast";

const CURRENCIES = ["USD", "EUR", "GBP", "AED"];

export default function FxRatesForm({ initial, lastUpdated }: { initial: Record<string, number>; lastUpdated: string | null }) {
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

  function refreshNow() {
    startTransition(async () => {
      const res = await refreshFxRatesNow();
      if (res?.error) { toast(res.error, { kind: "error" }); return; }
      if (res.updated) setRates((r) => ({ ...r, ...Object.fromEntries(Object.entries(res.updated!).map(([k, v]) => [k, String(v)])) }));
      toast("Pulled today's live rates");
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3">
      <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
        Rates refresh <b>automatically every day</b> from live mid-market rates.
        {lastUpdated ? <> Last updated {lastUpdated}.</> : <> Not pulled yet — tap “Refresh now”.</>}
      </div>
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
      <div className="flex gap-2">
        <button type="button" onClick={refreshNow} disabled={isPending} className="btn-secondary flex-1">{isPending ? "…" : "Refresh now"}</button>
        <button type="button" onClick={save} disabled={isPending} className="btn-primary flex-1">{isPending ? "Saving…" : "Save manually"}</button>
      </div>
      <p className="text-[11px] text-gray-400">Editing sets a rate until the next daily refresh replaces it.</p>
    </div>
  );
}
