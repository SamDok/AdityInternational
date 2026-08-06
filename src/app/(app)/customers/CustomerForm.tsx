"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/format";
import { COUNTRIES } from "@/lib/countries";
import { portsForCountry } from "@/lib/ports";
import { DIAL_CODES } from "@/lib/dialCodes";

type CustomerValues = {
  name?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  address?: string | null;
  country?: string | null;
  shippingAddress?: string | null;
  destinationPort?: string | null;
  incoterms?: string | null;
  gstin?: string | null;
  taxId?: string | null;
  currency?: string | null;
  paymentTerms?: string | null;
  creditLimit?: number | null;
  defaultDiscount?: number | null;
  category?: string | null;
  salespersonId?: string | null;
  tags?: string[] | null;
  notes?: string | null;
};

type Teammate = { id: string; name: string | null; email: string };

type Props = {
  initial?: CustomerValues;
  teammates: Teammate[];
  action: (formData: FormData) => Promise<{ error?: string; warning?: string } | void>;
  submitLabel: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="px-1 text-sm font-semibold text-gray-500">{title}</h2>
      <div className="card space-y-4">{children}</div>
    </section>
  );
}

export default function CustomerForm({ initial, teammates, action, submitLabel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [country, setCountry] = useState(initial?.country ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [altPhone, setAltPhone] = useState(initial?.altPhone ?? "");
  const router = useRouter();

  const portSuggestions = portsForCountry(country);

  // Picking a country prefills empty phone fields with its dial code, so the
  // user only types the local number (and WhatsApp links work worldwide).
  function onCountryChange(value: string) {
    setCountry(value);
    const code = DIAL_CODES[value];
    if (!code) return;
    setPhone((p) => (p.trim() === "" ? `${code} ` : p));
    setAltPhone((p) => (p.trim() === "" ? `${code} ` : p));
  }

  function onSubmit(formData: FormData) {
    setError(null);
    // If we've already shown a soft-duplicate warning, this submit confirms it.
    if (warning) formData.set("confirmDup", "1");
    startTransition(async () => {
      const res = await action(formData);
      if (res?.error) {
        setError(res.error);
        setWarning(null);
      } else if (res?.warning) {
        setWarning(res.warning);
      }
    });
  }

  const num = (v?: number | null) => (v === null || v === undefined ? "" : String(v));

  return (
    <form action={onSubmit} className="space-y-6 p-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      {warning && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {warning} <span className="font-normal">Press “{submitLabel} anyway” to continue.</span>
        </div>
      )}

      <Section title="Basics">
        <div>
          <label className="field-label" htmlFor="name">Company name *</label>
          <input id="name" name="name" required defaultValue={initial?.name ?? ""}
            className="field-input" placeholder="e.g. Classic Textile" autoFocus />
        </div>
        <div>
          <label className="field-label" htmlFor="contactPerson">Contact person</label>
          <input id="contactPerson" name="contactPerson" defaultValue={initial?.contactPerson ?? ""}
            className="field-input" placeholder="Who to reach at the company" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="field-input" placeholder="Phone" />
          </div>
          <div>
            <label className="field-label" htmlFor="altPhone">Alt phone / WhatsApp</label>
            <input id="altPhone" name="altPhone" type="tel" value={altPhone} onChange={(e) => setAltPhone(e.target.value)}
              className="field-input" placeholder="Alternate number" />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={initial?.email ?? ""}
            className="field-input" placeholder="Email" />
        </div>
      </Section>

      <Section title="Relationship">
        <div>
          <label className="field-label" htmlFor="category">Category</label>
          <input id="category" name="category" list="customer-category-options"
            defaultValue={initial?.category ?? ""} className="field-input"
            placeholder="e.g. Distributor" />
          <datalist id="customer-category-options">
            <option value="Distributor" />
            <option value="Retailer" />
            <option value="Agent" />
            <option value="Wholesaler" />
            <option value="Direct" />
          </datalist>
        </div>
        <div>
          <label className="field-label" htmlFor="salespersonId">Assigned salesperson</label>
          <select id="salespersonId" name="salespersonId" defaultValue={initial?.salespersonId ?? ""}
            className="field-input">
            <option value="">Unassigned</option>
            {teammates.map((t) => (
              <option key={t.id} value={t.id}>{t.name || t.email}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="tags">Tags</label>
          <input id="tags" name="tags" defaultValue={(initial?.tags ?? []).join(", ")}
            className="field-input" placeholder="VIP, slow payer, sampling" />
          <p className="mt-1 text-xs text-gray-400">Separate tags with commas.</p>
        </div>
      </Section>

      <Section title="Addresses & shipping">
        <div>
          <label className="field-label" htmlFor="address">Billing address</label>
          <textarea id="address" name="address" defaultValue={initial?.address ?? ""}
            className="field-input" rows={2} placeholder="Full billing address" />
        </div>
        <div>
          <label className="field-label" htmlFor="country">Country</label>
          <input id="country" name="country" list="country-options"
            value={country} onChange={(e) => onCountryChange(e.target.value)}
            className="field-input" placeholder="Start typing a country…" autoComplete="off" />
          <datalist id="country-options">
            {COUNTRIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className="field-label" htmlFor="shippingAddress">Shipping / consignee address</label>
          <textarea id="shippingAddress" name="shippingAddress" defaultValue={initial?.shippingAddress ?? ""}
            className="field-input" rows={2} placeholder="Ship-to, if different from billing" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="destinationPort">Destination port</label>
            <input id="destinationPort" name="destinationPort" list="port-options"
              defaultValue={initial?.destinationPort ?? ""}
              className="field-input" placeholder={country ? "Pick or type a port" : "e.g. New York"} autoComplete="off" />
            <datalist id="port-options">
              {portSuggestions.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div>
            <label className="field-label" htmlFor="incoterms">Incoterms</label>
            <input id="incoterms" name="incoterms" list="incoterms-options"
              defaultValue={initial?.incoterms ?? ""} className="field-input" placeholder="e.g. FOB" />
            <datalist id="incoterms-options">
              <option value="EXW" />
              <option value="FOB" />
              <option value="CFR" />
              <option value="CIF" />
              <option value="DAP" />
              <option value="DDP" />
            </datalist>
          </div>
        </div>
      </Section>

      <Section title="Tax & payment">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="gstin">GST number</label>
            <input id="gstin" name="gstin" defaultValue={initial?.gstin ?? ""}
              className="field-input" placeholder="GSTIN (India)" />
          </div>
          <div>
            <label className="field-label" htmlFor="taxId">Tax ID / VAT</label>
            <input id="taxId" name="taxId" defaultValue={initial?.taxId ?? ""}
              className="field-input" placeholder="Foreign tax / VAT" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="currency">Currency</label>
            <select id="currency" name="currency" defaultValue={initial?.currency ?? "INR"}
              className="field-input">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="paymentTerms">Payment terms</label>
            <input id="paymentTerms" name="paymentTerms" list="payment-terms-options"
              defaultValue={initial?.paymentTerms ?? ""} className="field-input" placeholder="e.g. Net 30" />
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="creditLimit">Credit limit</label>
            <input id="creditLimit" name="creditLimit" type="number" step="0.01" min="0"
              inputMode="decimal" defaultValue={num(initial?.creditLimit)}
              className="field-input" placeholder="Max outstanding" />
          </div>
          <div>
            <label className="field-label" htmlFor="defaultDiscount">Default discount (%)</label>
            <input id="defaultDiscount" name="defaultDiscount" type="number" step="0.01" min="0" max="100"
              inputMode="decimal" defaultValue={num(initial?.defaultDiscount)}
              className="field-input" placeholder="0" />
          </div>
        </div>
      </Section>

      <Section title="Notes">
        <div>
          <label className="field-label sr-only" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""}
            className="field-input" rows={2} placeholder="Anything else to remember" />
        </div>
      </Section>

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : warning ? `${submitLabel} anyway` : submitLabel}
        </button>
      </div>
    </form>
  );
}
