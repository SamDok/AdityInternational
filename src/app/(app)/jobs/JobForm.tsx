"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon, TrashIcon } from "@/components/Icons";
import { CURRENCIES } from "@/lib/format";
import { useToast } from "@/components/Toast";
import ProductTypeahead from "../orders/ProductTypeahead";
import type { ProductHit } from "../orders/actions";
import type { JobInput } from "./actions";

type Vendor = { id: string; name: string };
type Line = { key: string; id?: string; productId: string; productLabel: string; pieces: string; perPieceQty: string; rate: string; unit: string; dueDate: string; note: string };

export type JobInitial = {
  vendorId: string;
  kind: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  items: { id: string; productId: string; productLabel?: string; pieces: string; perPieceQty: string; rate: string; unit: string; dueDate: string; note: string }[];
};

let counter = 0;
const newKey = () => `j${counter++}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ key: newKey(), productId: "", productLabel: "", pieces: "", perPieceQty: "", rate: "", unit: "mtr", dueDate: "", note: "" });

// Total on a line: pieces × qty-per-piece (pieces blank/0 → just the qty).
function lineTotal(l: Line): number {
  const per = parseFloat(l.perPieceQty) || 0;
  const pcs = parseInt(l.pieces, 10);
  return pcs > 0 ? pcs * per : per;
}

export default function JobForm({
  vendors,
  hasProducts,
  defaultVendorId,
  initial,
  action,
  submitLabel,
}: {
  vendors: Vendor[];
  hasProducts: boolean;
  defaultVendorId?: string;
  initial?: JobInitial;
  action: (input: JobInput) => Promise<{ error?: string } | void>;
  submitLabel: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? defaultVendorId ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "JOB_WORK");
  const [currency, setCurrency] = useState(initial?.currency ?? "INR");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayStr());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.items.length
      ? initial.items.map((it) => ({ key: newKey(), id: it.id, productId: it.productId, productLabel: it.productLabel ?? "", pieces: it.pieces, perPieceQty: it.perPieceQty, rate: it.rate, unit: it.unit, dueDate: it.dueDate, note: it.note }))
      : [emptyLine()],
  );

  const noProducts = !hasProducts;

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function onProductPick(key: string, hit: ProductHit) {
    updateLine(key, { productId: hit.id, productLabel: hit.label, unit: hit.unit ?? "mtr" });
  }

  function submit() {
    setError(null);
    if (!vendorId) return setError("Please choose a vendor.");
    const clean = lines.filter((l) => l.productId && lineTotal(l) > 0);
    if (clean.length === 0) return setError("Add at least one product with a quantity.");
    const input: JobInput = {
      vendorId, kind: kind as "JOB_WORK" | "PURCHASE", currency, issueDate, dueDate: dueDate || null, notes: notes || null,
      items: clean.map((l) => ({ id: l.id, productId: l.productId, pieces: l.pieces === "" ? null : Number(l.pieces), perPieceQty: Number(l.perPieceQty), rate: l.rate === "" ? null : Number(l.rate), unit: l.unit, dueDate: l.dueDate || null, note: l.note || null })),
    };
    startTransition(async () => {
      const res = await action(input);
      if (res?.error) setError(res.error);
      else toast(initial ? "Job updated" : "Job created");
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
                <ProductTypeahead value={l.productId} label={l.productLabel} onPick={(hit) => onProductPick(l.key, hit)} />
              </div>
              {/* Pieces × qty-per-piece = total (same as the order form) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Pieces</label>
                  <input value={l.pieces} onChange={(e) => updateLine(l.key, { pieces: e.target.value })} type="number" inputMode="numeric" step="1" min="0" className="field-input" placeholder="e.g. 10" />
                </div>
                <div>
                  <label className="field-label">Qty / piece ({l.unit})</label>
                  <input value={l.perPieceQty} onChange={(e) => updateLine(l.key, { perPieceQty: e.target.value })} type="number" inputMode="decimal" step="0.01" min="0" className="field-input" placeholder="0" />
                </div>
              </div>
              <p className="px-1 text-xs text-gray-500">
                Total: <span className="font-semibold text-gray-700">{lineTotal(l) || 0} {l.unit}</span>
                {parseInt(l.pieces, 10) > 0 && <span className="text-gray-400"> ({parseInt(l.pieces, 10)} × {parseFloat(l.perPieceQty) || 0})</span>}
              </p>
              <div>
                <label className="field-label">Rate you pay / {l.unit}</label>
                <input value={l.rate} onChange={(e) => updateLine(l.key, { rate: e.target.value })} type="number" inputMode="decimal" step="0.01" min="0" className="field-input" placeholder="Making charge / cost" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Due by</label>
                  <input value={l.dueDate} onChange={(e) => updateLine(l.key, { dueDate: e.target.value })} type="date" className="field-input" />
                </div>
                <div>
                  <label className="field-label">Line note</label>
                  <input value={l.note} onChange={(e) => updateLine(l.key, { note: e.target.value })} className="field-input" placeholder="e.g. colour, base given" />
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
