"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { DIAL_CODES } from "@/lib/dialCodes";

type Values = {
  name?: string | null;
  kind?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  country?: string | null;
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

      <div>
        <label className="field-label" htmlFor="kind">Type</label>
        <select id="kind" name="kind" defaultValue={initial?.kind ?? "KAARIGAR"} className="field-input">
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="phone">Phone</label>
        <input id="phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          className="field-input" placeholder="Phone" />
      </div>

      <div>
        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" defaultValue={initial?.email ?? ""}
          className="field-input" placeholder="Email (optional)" />
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
