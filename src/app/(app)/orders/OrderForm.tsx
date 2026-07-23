"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENCIES, UNITS, ORDER_STATUSES, STATUS_LABELS, formatMoney, type OrderStatus } from "@/lib/format";
import { PlusIcon, TrashIcon } from "@/components/Icons";
import type { OrderInput } from "./actions";

type CustomerOpt = { id: string; name: string; currency: string };
type ProductOpt = { id: string; label: string; group: string; unit: string; salePrice: number };

type Line = {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
};

type InitialOrder = {
  customerId: string;
  currency: string;
  status: string;
  orderDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  items: { productId: string; description?: string | null; quantity: number; unit: string; rate: number }[];
};

type Props = {
  customers: CustomerOpt[];
  products: ProductOpt[];
  initial?: InitialOrder;
  defaultCustomerId?: string;
  action: (input: OrderInput) => Promise<{ error?: string } | void>;
  submitLabel: string;
};

let counter = 0;
const newKey = () => `l${counter++}`;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(): Line {
  return { key: newKey(), productId: "", description: "", quantity: "", unit: "mtr", rate: "" };
}

export default function OrderForm({ customers, products, initial, defaultCustomerId, action, submitLabel }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const startCustomerId = initial?.customerId ?? defaultCustomerId ?? "";
  const [customerId, setCustomerId] = useState(startCustomerId);
  const [currency, setCurrency] = useState(
    initial?.currency ?? customers.find((c) => c.id === startCustomerId)?.currency ?? "INR",
  );
  const [status, setStatus] = useState<string>(initial?.status ?? "DRAFT");
  const [orderDate, setOrderDate] = useState(initial?.orderDate?.slice(0, 10) ?? todayStr());
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.items.length
      ? initial.items.map((it) => ({
          key: newKey(),
          productId: it.productId,
          description: it.description ?? "",
          quantity: String(it.quantity),
          unit: it.unit,
          rate: String(it.rate),
        }))
      : [emptyLine()],
  );

  const noCustomers = customers.length === 0;
  const noProducts = products.length === 0;

  // Group product options by their type for the <optgroup> picker.
  const productGroups = useMemo(() => {
    const map = new Map<string, ProductOpt[]>();
    for (const p of products) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group)!.push(p);
    }
    return [...map.entries()];
  }, [products]);

  function onCustomerChange(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) setCurrency(c.currency); // default to the customer's currency
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onProductChange(key: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateLine(key, {
      productId,
      unit: p?.unit ?? "mtr",
      rate: p ? String(p.salePrice) : "",
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  const grandTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0),
    [lines],
  );

  function onSubmit() {
    setError(null);
    if (!customerId) return setError("Please choose a customer");
    const cleanLines = lines.filter((l) => l.productId && parseFloat(l.quantity) > 0);
    if (cleanLines.length === 0) return setError("Add at least one product with a quantity");

    const input: OrderInput = {
      customerId,
      currency,
      status: status as OrderStatus,
      orderDate,
      dueDate: dueDate || null,
      notes: notes || null,
      items: cleanLines.map((l) => ({
        productId: l.productId,
        description: l.description || null,
        quantity: Number(l.quantity),
        unit: l.unit,
        rate: Number(l.rate),
      })),
    };

    startTransition(async () => {
      const res = await action(input);
      if (res?.error) setError(res.error);
    });
  }

  if (noCustomers || noProducts) {
    return (
      <div className="p-4">
        <div className="card space-y-3 text-center">
          <p className="text-gray-700">Before making an order you need at least one customer and one product.</p>
          <div className="flex flex-col gap-2">
            {noCustomers && <Link href="/customers/new" className="btn-primary">Add a customer</Link>}
            {noProducts && <Link href="/products/design/new" className="btn-secondary">Add a product</Link>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      )}

      {/* Customer + currency */}
      <div className="card space-y-4">
        <div>
          <label className="field-label" htmlFor="customer">Customer *</label>
          <select id="customer" value={customerId} onChange={(e) => onCustomerChange(e.target.value)} className="field-input">
            <option value="">Choose a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="currency">Currency</label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="field-input">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="status">Status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="field-input">
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Product lines */}
      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Products</h2>
        <div className="space-y-3">
          {lines.map((l, idx) => {
            const lineTotal = (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0);
            return (
              <div key={l.key} className="card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">Line {idx + 1}</span>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(l.key)} aria-label="Remove line" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="field-label">Product</label>
                  <select value={l.productId} onChange={(e) => onProductChange(l.key, e.target.value)} className="field-input">
                    <option value="">Choose a product…</option>
                    {productGroups.map(([group, opts]) => (
                      <optgroup key={group} label={group}>
                        {opts.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Description</label>
                  <input value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} className="field-input" placeholder="e.g. colour / spec (optional)" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="field-label">Qty</label>
                    <input value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} className="field-input" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" />
                  </div>
                  <div>
                    <label className="field-label">Unit</label>
                    <select value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} className="field-input">
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Rate</label>
                    <input value={l.rate} onChange={(e) => updateLine(l.key, { rate: e.target.value })} className="field-input" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" />
                  </div>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
                  <span className="text-gray-500">Line total</span>
                  <span className="font-semibold text-gray-900">{formatMoney(lineTotal, currency)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={addLine} className="btn-secondary mt-3 w-full">
          <PlusIcon className="h-5 w-5" /> Add another product
        </button>
      </div>

      {/* Grand total */}
      <div className="card flex items-center justify-between bg-brand-50">
        <span className="text-base font-semibold text-brand-900">Order total</span>
        <span className="text-2xl font-bold text-brand-900">{formatMoney(grandTotal, currency)}</span>
      </div>

      {/* Dates + notes */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="orderDate">Order date</label>
            <input id="orderDate" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="dueDate">Due date</label>
            <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="field-input" />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="notes">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field-input" placeholder="Shipping, packing, anything to remember" />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={onSubmit} disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
