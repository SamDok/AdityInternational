"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { CURRENCIES } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/money";

const todayStr = () => new Date().toISOString().slice(0, 10);

type AllocKey = "shipmentId" | "jobId" | "materialPoId";
// An option may carry its own key, so one dropdown can mix bill types (e.g. a
// supplier's job bills and material-PO bills).
type Alloc = { id: string; label: string; key?: AllocKey };

export default function PaymentForm({
  action,
  defaultCurrency,
  allocations,
  allocationKey,
  allocationLabel,
  buttonLabel = "Record payment",
  fxRates,
}: {
  action: (input: unknown) => Promise<{ error?: string; ok?: boolean } | void>;
  defaultCurrency: string;
  allocations?: Alloc[];
  allocationKey?: AllocKey;
  allocationLabel?: string;
  buttonLabel?: string;
  // INR-per-unit reference rates, to prefill the realization rate on a foreign receipt.
  fxRates?: Record<string, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const rateFor = (cur: string) => (cur !== "INR" && fxRates?.[cur] ? String(fxRates[cur]) : "");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [fxRate, setFxRate] = useState(rateFor(defaultCurrency));
  const [date, setDate] = useState(todayStr());
  const [method, setMethod] = useState("Bank");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [allocId, setAllocId] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return toast("Enter an amount greater than zero", { kind: "error" });
    const rate = parseFloat(fxRate);
    const input: Record<string, unknown> = { amount: n, currency, date, method, reference: reference || null, note: note || null, fxRate: currency !== "INR" && rate > 0 ? rate : null };
    if (allocId) {
      const key = allocations?.find((a) => a.id === allocId)?.key ?? allocationKey;
      if (key) input[key] = allocId;
    }
    startTransition(async () => {
      const res = await action(input);
      if (res?.error) return toast(res.error, { kind: "error" });
      setAmount(""); setReference(""); setNote(""); setAllocId("");
      setOpen(false);
      toast("Payment recorded");
      router.refresh();
    });
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full">{buttonLabel}</button>;
  }

  return (
    <div className="card space-y-3">
      <p className="font-semibold text-gray-900">{buttonLabel}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Amount</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" step="0.01" min="0" autoFocus className="field-input" placeholder="0.00" />
        </div>
        <div>
          <label className="field-label">Currency</label>
          <select value={currency} onChange={(e) => { setCurrency(e.target.value); setFxRate(rateFor(e.target.value)); }} className="field-input">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {currency !== "INR" && (
        <div>
          <label className="field-label">Rate at receipt <span className="text-gray-400">(INR per {currency})</span></label>
          <input value={fxRate} onChange={(e) => setFxRate(e.target.value)} type="number" inputMode="decimal" step="0.0001" min="0" className="field-input" placeholder="e.g. 83.20" />
          <p className="mt-1 text-xs text-gray-400">The rate you actually realised — used for FX gain/loss vs the invoice rate.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Date</label>
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="field-input" />
        </div>
        <div>
          <label className="field-label">Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="field-input">
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      {allocations && allocations.length > 0 && (
        <div>
          <label className="field-label">{allocationLabel ?? "Against"} <span className="text-gray-400">(optional)</span></label>
          <select value={allocId} onChange={(e) => setAllocId(e.target.value)} className="field-input">
            <option value="">— not tied to one —</option>
            {allocations.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="field-label">Reference <span className="text-gray-400">(UTR / cheque / LC no.)</span></label>
        <input value={reference} onChange={(e) => setReference(e.target.value)} className="field-input" placeholder="Optional" />
      </div>
      <div>
        <label className="field-label">Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="field-input" placeholder="Optional" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-primary flex-1">{isPending ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
