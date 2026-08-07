"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { addNextStage } from "./actions";

type Vendor = { id: string; name: string };

export default function NextStageForm({ jobId, vendors }: { jobId: string; vendors: Vendor[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [stageName, setStageName] = useState("");
  const [rate, setRate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [alsoNext, setAlsoNext] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!vendorId) return toast("Choose a kaarigar for the next step", { kind: "error" });
    if (!stageName.trim()) return toast("Name this step (e.g. Wash)", { kind: "error" });
    startTransition(async () => {
      const res = await addNextStage(jobId, {
        vendorId, stageName: stageName.trim(),
        rate: rate === "" ? null : Number(rate),
        dueDate: dueDate || null,
        sendToNextProcess: alsoNext,
      });
      // On success the action redirects; only an error comes back here.
      if (res?.error) toast(res.error, { kind: "error" });
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full">
        Send to next stage →
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <p className="font-semibold text-gray-900">Send work to the next kaarigar</p>
      <p className="text-xs text-gray-500">Carries this stage&apos;s received (work-in-progress) pieces forward as the next job&apos;s quantity.</p>
      <div>
        <label className="field-label">Next step</label>
        <input value={stageName} onChange={(e) => setStageName(e.target.value)} list="stage-name-options" className="field-input" placeholder="e.g. Wash, Finishing, Ironing" />
        <datalist id="stage-name-options">
          <option value="Wash" /><option value="Finishing" /><option value="Ironing" /><option value="Dyeing" /><option value="Stitching" /><option value="Packing" />
        </datalist>
      </div>
      <div>
        <label className="field-label">Kaarigar</label>
        <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="field-input">
          <option value="">Choose…</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Rate <span className="text-gray-400">(per unit, optional)</span></label>
          <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" step="0.01" min="0" inputMode="decimal" className="field-input" placeholder="Making charge" />
        </div>
        <div>
          <label className="field-label">Expected by <span className="text-gray-400">(optional)</span></label>
          <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className="field-input" />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={alsoNext} onChange={(e) => setAlsoNext(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>This step also passes to another kaarigar afterwards (not the final step)</span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-primary flex-1">{isPending ? "Creating…" : "Create next stage"}</button>
      </div>
    </div>
  );
}
