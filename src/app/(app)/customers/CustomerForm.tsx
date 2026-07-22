"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/format";

type CustomerValues = {
  name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  gstin?: string | null;
  currency?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
};

type Props = {
  initial?: CustomerValues;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitLabel: string;
};

export default function CustomerForm({ initial, action, submitLabel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await action(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5 p-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="name">Name *</label>
        <input id="name" name="name" required defaultValue={initial?.name ?? ""}
          className="field-input" placeholder="e.g. Classic Textile" autoFocus />
      </div>

      <div>
        <label className="field-label" htmlFor="company">Company</label>
        <input id="company" name="company" defaultValue={initial?.company ?? ""}
          className="field-input" placeholder="Company name (optional)" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""}
            className="field-input" placeholder="Phone" />
        </div>
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={initial?.email ?? ""}
            className="field-input" placeholder="Email" />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="address">Address</label>
        <textarea id="address" name="address" defaultValue={initial?.address ?? ""}
          className="field-input" rows={2} placeholder="Full address" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="country">Country</label>
          <input id="country" name="country" defaultValue={initial?.country ?? ""}
            className="field-input" placeholder="Country" />
        </div>
        <div>
          <label className="field-label" htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue={initial?.currency ?? "INR"}
            className="field-input">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="gstin">GST number</label>
        <input id="gstin" name="gstin" defaultValue={initial?.gstin ?? ""}
          className="field-input" placeholder="GSTIN (optional)" />
      </div>

      <div>
        <label className="field-label" htmlFor="paymentTerms">Payment terms</label>
        <input id="paymentTerms" name="paymentTerms" list="payment-terms-options"
          defaultValue={initial?.paymentTerms ?? ""}
          className="field-input" placeholder="e.g. Net 30" />
        <datalist id="payment-terms-options">
          <option value="Advance" />
          <option value="On delivery" />
          <option value="Net 15" />
          <option value="Net 30" />
          <option value="Net 45" />
          <option value="Net 60" />
          <option value="Net 90" />
          <option value="LC at sight" />
          <option value="50% advance, 50% on delivery" />
        </datalist>
      </div>

      <div>
        <label className="field-label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""}
          className="field-input" rows={2} placeholder="Anything else to remember" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
