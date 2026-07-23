"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon, TrashIcon } from "@/components/Icons";
import { CURRENCIES } from "@/lib/format";
import ProductPicker from "../orders/ProductPicker";
import type { JobInput } from "./actions";

type Vendor = { id: string; name: string };
type ProductOpt = { id: string; label: string; group: string; unit: string };
type Line = { key: string; productId: string; qty: string; rate: string; unit: string };

let counter = 0;
const newKey = () => `j${counter++}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ key: newKey(), productId: "", qty: "", rate: "", unit: "mtr" });

export default function JobForm({
  vendors,
  products,
  defaultVendorId,
  action,
  submitLabel,
}: {
  vendors: Vendor[];
  products: ProductOpt[];
  defaultVendorId?: string;
  action: (input: JobInput) => Promise<{ error?: string } | void>;
  submitLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [vendorId, setVendorId] = useState(defaultVendorId ?? "");
  const [kind, setKind] = useState("JOB_WORK");
  const [currency, setCurrency] = useState("INR");
  const [issueDate, setIssueDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const noProducts = products.length === 0;

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function onProduct(key: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateLine(key, { productId, unit: p?.unit ?? "mtr" });
  }

  function submit() {
    setError(null);
    if (!vendorId) return setError("Please choose a vendor.");
    const clean = lines.filter((l) => l.productId && parseFloat(l.qty) > 0);
    if (clean.length === 0) return setError("Add at least one product with a quantity.");
    const input: JobInput = {
      vendorId, kind: kind as "JOB_WORK" | "PURCHASE", currency, issueDate, dueDate: dueDate || null, notes: notes || null,
      items: clean.map((l) => ({ productId: l.productId, qtyOrdered: Number(l.qty), rate: l.rate === "" ? null : Number(l.rate), unit: l.unit })),
    };
    startTransition(async () => {
      const res = await action(input);
      if (res?.error) setError(res.error);
    });
  }

  if (noProducts) {
    return (
      <div className="p-4">
        <div className="card space-y-3 text-center">
          <p className="text-gray-700">Add a design and its widths first, then create a job.</p>
          <Link href="/products/design/new" className="btn-primary">Add a design</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="card space-y-4">
        <div>
          <label className="field-label" htmlFor="vendor">Vendor *</label>
          <select id="vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="field-input">
            <option value="">Choose a kaarigar / supplier…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="kind">Type</label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="field-input">
              <option value="JOB_WORK">Job work</option>
              <option value="PURCHASE">Purchase (trading)</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="currency">Currency</label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="field-input">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Products</h2>
        <div className="space-y-3">
          {lines.map((l, idx) => (
            <div key={l.key} className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">Line {idx + 1}</span>
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))} aria-label="Remove line" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div>
                <label className="field-label">Product</label>
                <ProductPicker options={products} value={l.productId} onChange={(pid) => onProduct(l.key, pid)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Quantity ({l.unit})</label>
                  <input value={l.qty} onChange={(e) => updateLine(l.key, { qty: e.target.value })} type="number" inputMode="decimal" step="0.01" min="0" className="field-input" placeholder="0" />
                </div>
                <div>
                  <label className="field-label">Rate you pay</label>
                  <input value={l.rate} onChange={(e) => updateLine(l.key, { rate: e.target.value })} type="number" inputMode="decimal" step="0.01" min="0" className="field-input" placeholder="Making charge / cost" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])} className="btn-secondary mt-3 w-full">
          <PlusIcon className="h-5 w-5" /> Add another product
        </button>
      </div>

      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="issueDate">Job date</label>
            <input id="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="dueDate">Expected by</label>
            <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="field-input" />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="notes">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field-input" placeholder="Base fabric given, instructions…" />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-primary flex-1">{isPending ? "Saving…" : submitLabel}</button>
      </div>
    </div>
  );
}
