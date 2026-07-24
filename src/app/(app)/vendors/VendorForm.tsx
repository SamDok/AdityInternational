"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { DIAL_CODES } from "@/lib/dialCodes";
import { CURRENCIES } from "@/lib/format";

type Values = {
  name?: string | null;
  kind?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  address?: string | null;
  country?: string | null;
  gstin?: string | null;
  currency?: string | null;
  paymentTerms?: string | null;
  leadDays?: number | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  bankSwift?: string | null;
  bankBranch?: string | null;
  notes?: string | null;
};

const KINDS = [
  { value: "KAARIGAR", label: "Kaarigar (maker)" },
  { value: "SUPPLIER", label: "Supplier (trading)" },
  { value: "BOTH", label: "Both" },
];

export default function VendorForm({
  initial,
  action,
  submitLabel,
}: {
  initial?: Values;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [country, setCountry] = useState(initial?.country ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const router = useRouter();

  function onCountryChange(value: string) {
    setCountry(value);
    const code = DIAL_CODES[value];
    if (code) setPhone((p) => (p.trim() === "" ? `${code} ` : p));
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await action(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5 p-4">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div>
        <label className="field-label" htmlFor="name">Name *</label>
        <input id="name" name="name" required defaultValue={initial?.name ?? ""}
          className="field-input" placeholder="e.g. Imran Bhai (embroidery)" autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="kind">Type</label>
          <select id="kind" name="kind" defaultValue={initial?.kind ?? "KAARIGAR"} className="field-input">
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="contactPerson">Contact person</label>
          <input id="contactPerson" name="contactPerson" defaultValue={initial?.contactPerson ?? ""}
            className="field-input" placeholder="Named person" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="field-input" placeholder="Phone" />
        </div>
        <div>
          <label className="field-label" htmlFor="altPhone">WhatsApp / alt</label>
          <input id="altPhone" name="altPhone" type="tel" defaultValue={initial?.altPhone ?? ""}
            className="field-input" placeholder="Second number" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={initial?.email ?? ""}
            className="field-input" placeholder="Optional" />
        </div>
        <div>
          <label className="field-label" htmlFor="gstin">GSTIN</label>
          <input id="gstin" name="gstin" defaultValue={initial?.gstin ?? ""}
            className="field-input" placeholder="GST number" />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="address">Address</label>
        <textarea id="address" name="address" defaultValue={initial?.address ?? ""}
          className="field-input" rows={2} placeholder="Address" />
      </div>

      <div>
        <label className="field-label" htmlFor="country">Country</label>
        <input id="country" name="country" list="vendor-country-options"
          value={country} onChange={(e) => onCountryChange(e.target.value)}
          className="field-input" placeholder="Start typing a country…" autoComplete="off" />
        <datalist id="vendor-country-options">
          {COUNTRIES.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="field-label" htmlFor="currency">Pay in</label>
          <select id="currency" name="currency" defaultValue={initial?.currency ?? "INR"} className="field-input">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="paymentTerms">Payment terms</label>
          <input id="paymentTerms" name="paymentTerms" defaultValue={initial?.paymentTerms ?? ""}
            className="field-input" placeholder="e.g. Advance" />
        </div>
        <div>
          <label className="field-label" htmlFor="leadDays">Lead days</label>
          <input id="leadDays" name="leadDays" type="number" min="0" inputMode="numeric" defaultValue={initial?.leadDays ?? ""}
            className="field-input" placeholder="e.g. 21" />
        </div>
      </div>

      <details className="rounded-xl bg-gray-50 p-3 ring-1 ring-inset ring-gray-200">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">Bank details (for paying them)</summary>
        <div className="mt-3 space-y-3">
          <input name="bankName" defaultValue={initial?.bankName ?? ""} className="field-input" placeholder="Bank name" />
          <div className="grid grid-cols-2 gap-3">
            <input name="bankAccountName" defaultValue={initial?.bankAccountName ?? ""} className="field-input" placeholder="Account name" />
            <input name="bankAccountNo" defaultValue={initial?.bankAccountNo ?? ""} className="field-input" placeholder="Account no." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input name="bankIfsc" defaultValue={initial?.bankIfsc ?? ""} className="field-input" placeholder="IFSC" />
            <input name="bankSwift" defaultValue={initial?.bankSwift ?? ""} className="field-input" placeholder="SWIFT" />
            <input name="bankBranch" defaultValue={initial?.bankBranch ?? ""} className="field-input" placeholder="Branch" />
          </div>
        </div>
      </details>

      <div>
        <label className="field-label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""}
          className="field-input" rows={2} placeholder="Anything to remember" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
