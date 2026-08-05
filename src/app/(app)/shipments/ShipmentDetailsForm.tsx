"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type Values = {
  discountPct?: number | null;
  freight?: number | null;
  insurance?: number | null;
  otherCharges?: number | null;
  fxRate?: number | null;
  marksNumbers?: string | null;
  grossWeight?: number | null;
  portOfLoading?: string | null;
  vessel?: string | null;
  blAwbNo?: string | null;
  containerNo?: string | null;
  shippingBillNo?: string | null;
  eInvoiceIrn?: string | null;
  ewayBillNo?: string | null;
  notes?: string | null;
};

const numFields = ["discountPct", "freight", "insurance", "otherCharges", "fxRate", "grossWeight"] as const;

export default function ShipmentDetailsForm({
  currency,
  initial,
  action,
}: {
  currency: string;
  initial: Values;
  action: (input: unknown) => Promise<{ error?: string; ok?: boolean } | void>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const input: Record<string, unknown> = {};
    for (const [k, v] of formData.entries()) input[k] = v === "" ? null : v;
    for (const f of numFields) input[f] = input[f] == null ? null : Number(input[f]);
    startTransition(async () => {
      const res = await action(input);
      if (res?.error) return toast(res.error, { kind: "error" });
      setOpen(false);
      toast("Details saved");
      router.refresh();
    });
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full">Edit invoice &amp; export details</button>;
  }

  const num = (name: keyof Values, label: string, hint = "") => (
    <div>
      <label className="field-label">{label}</label>
      <input name={name} type="number" step="0.01" min="0" defaultValue={initial[name] ?? ""} className="field-input" placeholder={hint} />
    </div>
  );
  const txt = (name: keyof Values, label: string) => (
    <div>
      <label className="field-label">{label}</label>
      <input name={name} defaultValue={(initial[name] as string) ?? ""} className="field-input" />
    </div>
  );

  return (
    <form action={submit} className="card space-y-4">
      <p className="font-semibold text-gray-900">Invoice &amp; export details</p>

      <div className="grid grid-cols-2 gap-3">
        {num("discountPct", "Discount %")}
        {num("fxRate", `INR per 1 ${currency}`, currency === "INR" ? "n/a" : "e.g. 83.5")}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {num("freight", "Freight")}
        {num("insurance", "Insurance")}
        {num("otherCharges", "Other")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {txt("marksNumbers", "Marks & numbers")}
        {num("grossWeight", "Gross weight (kg)")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {txt("portOfLoading", "Port of loading")}
        {txt("vessel", "Vessel / flight")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {txt("blAwbNo", "B/L or AWB no.")}
        {txt("containerNo", "Container no.")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {txt("shippingBillNo", "Shipping bill no.")}
        {txt("ewayBillNo", "e-Way bill no.")}
      </div>
      {txt("eInvoiceIrn", "e-Invoice IRN")}
      <div>
        <label className="field-label">Notes</label>
        <input name="notes" defaultValue={initial.notes ?? ""} className="field-input" />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1">{isPending ? "Saving…" : "Save details"}</button>
      </div>
    </form>
  );
}
