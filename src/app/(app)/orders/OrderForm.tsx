"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENCIES, UNITS, ORDER_STAGES, STAGE_LABELS, formatMoney, type OrderStage } from "@/lib/format";
import { PlusIcon, TrashIcon } from "@/components/Icons";
import ProductPicker from "./ProductPicker";
import type { OrderInput } from "./actions";
import { saveCustomerRegularPrice } from "../customers/actions";
import { useToast } from "@/components/Toast";

type CustomerOpt = {
  id: string;
  name: string;
  currency: string;
  company?: string | null;
  address?: string | null;
  gstin?: string | null;
  taxId?: string | null;
  shippingAddress?: string | null;
  destinationPort?: string | null;
  incoterms?: string | null;
  paymentTerms?: string | null;
  defaultDiscount?: number | null;
};
type ProductOpt = { id: string; label: string; group: string; unit: string };

type Line = {
  key: string;
  id?: string; // set for lines that already exist (so edits update in place)
  productId: string;
  description: string;
  pieces: string; // number of pieces (blank = loose metres)
  perPieceQty: string; // metres in each piece
  dueDate: string; // this line's own due date (blank = use the order's)
  unit: string;
  rate: string;
};

// Total metres on a line: pieces × qty-per-piece (pieces blank/0 → just the qty).
function lineMetres(l: Line): number {
  const per = parseFloat(l.perPieceQty) || 0;
  const pcs = parseInt(l.pieces, 10);
  return pcs > 0 ? pcs * per : per;
}

// The frozen customer-detail snapshot the order carries onto its PDF.
type Snapshot = {
  billToName: string;
  billToAddress: string;
  billToTaxId: string;
  shipToName: string;
  shipToAddress: string;
  destinationPort: string;
  incoterms: string;
  paymentTerms: string;
};

type InitialOrder = {
  customerId: string;
  currency: string;
  status: string;
  orderDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  discountPct?: number | null;
  items: { id?: string; productId: string; description?: string | null; quantity: number; pieces?: number | null; perPieceQty?: number | null; dueDate?: string | null; unit: string; rate: number }[];
} & Partial<Record<keyof Snapshot, string | null>>;

type Props = {
  customers: CustomerOpt[];
  products: ProductOpt[];
  pricesByCustomer: Record<string, Record<string, number>>;
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
  return { key: newKey(), productId: "", description: "", pieces: "", perPieceQty: "", dueDate: "", unit: "mtr", rate: "" };
}

const EMPTY_SNAPSHOT: Snapshot = {
  billToName: "", billToAddress: "", billToTaxId: "", shipToName: "",
  shipToAddress: "", destinationPort: "", incoterms: "", paymentTerms: "",
};

// Pull a fresh snapshot off a customer record (what goes on the PDF).
function snapshotFromCustomer(c: CustomerOpt): Snapshot {
  return {
    billToName: c.company || c.name || "",
    billToAddress: c.address || "",
    billToTaxId: c.gstin || c.taxId || "",
    shipToName: "", // consignee — filled only if it differs from bill-to
    shipToAddress: c.shippingAddress || "",
    destinationPort: c.destinationPort || "",
    incoterms: c.incoterms || "",
    paymentTerms: c.paymentTerms || "",
  };
}

const INCOTERMS = ["", "EXW", "FOB", "CFR", "CIF", "DAP", "DDP"];

export default function OrderForm({ customers, products, pricesByCustomer, initial, defaultCustomerId, action, submitLabel }: Props) {
  const router = useRouter();
  const toast = useToast();
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
  // Header discount %, from the saved order when editing else the customer's standing discount.
  const [discountPct, setDiscountPct] = useState(() => {
    if (initial) return initial.discountPct != null ? String(initial.discountPct) : "";
    const c = customers.find((x) => x.id === startCustomerId);
    return c?.defaultDiscount != null ? String(c.defaultDiscount) : "";
  });

  // Customer-detail snapshot: from the saved order when editing, else prefilled
  // from the chosen customer on a new order.
  const [snap, setSnap] = useState<Snapshot>(() => {
    if (initial) {
      return {
        billToName: initial.billToName ?? "",
        billToAddress: initial.billToAddress ?? "",
        billToTaxId: initial.billToTaxId ?? "",
        shipToName: initial.shipToName ?? "",
        shipToAddress: initial.shipToAddress ?? "",
        destinationPort: initial.destinationPort ?? "",
        incoterms: initial.incoterms ?? "",
        paymentTerms: initial.paymentTerms ?? "",
      };
    }
    const c = customers.find((x) => x.id === startCustomerId);
    return c ? snapshotFromCustomer(c) : { ...EMPTY_SNAPSHOT };
  });
  const setSnapField = (k: keyof Snapshot, v: string) => setSnap((p) => ({ ...p, [k]: v }));

  const [lines, setLines] = useState<Line[]>(
    initial?.items.length
      ? initial.items.map((it) => {
          // Prefer the stored per-piece value; reconstruct it for older orders.
          const per = it.perPieceQty != null
            ? it.perPieceQty
            : it.pieces && it.pieces > 0
              ? it.quantity / it.pieces
              : it.quantity;
          return {
            key: newKey(),
            id: it.id,
            productId: it.productId,
            description: it.description ?? "",
            pieces: it.pieces != null ? String(it.pieces) : "",
            perPieceQty: String(per),
            dueDate: it.dueDate?.slice(0, 10) ?? "",
            unit: it.unit,
            rate: String(it.rate),
          };
        })
      : [emptyLine()],
  );

  const noCustomers = customers.length === 0;
  const noProducts = products.length === 0;

  // Locally-saved regular prices this session (so the hint updates without a
  // full reload, and without mutating the pricesByCustomer prop).
  const [savedOverrides, setSavedOverrides] = useState<Record<string, number>>({});

  // The customer's saved regular price for a product, if any (else null).
  function savedPriceFor(productId: string, custId: string): number | null {
    if (!productId || !custId) return null;
    const override = savedOverrides[`${custId}:${productId}`];
    if (override != null) return override;
    const p = pricesByCustomer[custId]?.[productId];
    return p != null ? p : null;
  }

  // What to prefill a line's rate with: only the customer's regular price. There
  // is no product-level default price in this business.
  function rateFor(productId: string, custId: string): string {
    const saved = savedPriceFor(productId, custId);
    return saved != null ? String(saved) : "";
  }

  function onCustomerChange(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCurrency(c.currency); // default to the customer's currency
      setSnap(snapshotFromCustomer(c)); // refresh the PDF snapshot from this customer
      setDiscountPct(c.defaultDiscount != null ? String(c.defaultDiscount) : "");
    } else {
      setSnap({ ...EMPTY_SNAPSHOT });
      setDiscountPct("");
    }
    // Re-price existing lines for the new customer.
    setLines((prev) => prev.map((l) => (l.productId ? { ...l, rate: rateFor(l.productId, id) } : l)));
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onProductChange(key: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateLine(key, {
      productId,
      unit: p?.unit ?? "mtr",
      rate: rateFor(productId, customerId),
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  const grandTotal = useMemo(
    () => lines.reduce((sum, l) => sum + lineMetres(l) * (parseFloat(l.rate) || 0), 0),
    [lines],
  );

  // Opt-in: save a line's rate as this customer's regular price (never automatic).
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  function saveRegularPrice(l: Line) {
    const price = parseFloat(l.rate);
    if (!customerId || !l.productId || !(price >= 0)) return;
    setSavingKey(l.key);
    startTransition(async () => {
      const res = await saveCustomerRegularPrice(customerId, l.productId, price, currency);
      setSavingKey(null);
      if (res?.error) toast(res.error, { kind: "error" });
      else {
        // Reflect it locally so the "one-off" hint clears immediately.
        setSavedOverrides((o) => ({ ...o, [`${customerId}:${l.productId}`]: price }));
        setSavedKeys((prev) => new Set(prev).add(l.key));
        toast("Saved as this customer's regular price");
      }
    });
  }

  function onSubmit() {
    setError(null);
    if (!customerId) return setError("Please choose a customer");
    const cleanLines = lines.filter((l) => l.productId && lineMetres(l) > 0);
    if (cleanLines.length === 0) return setError("Add at least one product with a quantity");

    const input: OrderInput = {
      customerId,
      currency,
      status: status as OrderStage,
      orderDate,
      dueDate: dueDate || null,
      notes: notes || null,
      billToName: snap.billToName || null,
      billToAddress: snap.billToAddress || null,
      billToTaxId: snap.billToTaxId || null,
      shipToName: snap.shipToName || null,
      shipToAddress: snap.shipToAddress || null,
      destinationPort: snap.destinationPort || null,
      incoterms: snap.incoterms || null,
      paymentTerms: snap.paymentTerms || null,
      discountPct: discountPct === "" ? null : Number(discountPct),
      items: cleanLines.map((l) => ({
        id: l.id,
        productId: l.productId,
        description: l.description || null,
        pieces: l.pieces === "" ? null : Number(l.pieces),
        perPieceQty: Number(l.perPieceQty),
        dueDate: l.dueDate || null,
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
            <label className="field-label" htmlFor="status">Stage</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="field-input">
              {ORDER_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Customer details snapshot — what prints on the proforma PDF */}
      {customerId && (
        <details className="card">
          <summary className="cursor-pointer list-none font-semibold text-gray-900">
            Customer details on the PDF
            <span className="ml-1 text-xs font-normal text-gray-400">— prefilled, tap to edit</span>
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <label className="field-label">Bill to (name)</label>
              <input value={snap.billToName} onChange={(e) => setSnapField("billToName", e.target.value)} className="field-input" placeholder="Company / customer name" />
            </div>
            <div>
              <label className="field-label">Bill-to address</label>
              <textarea value={snap.billToAddress} onChange={(e) => setSnapField("billToAddress", e.target.value)} rows={2} className="field-input" placeholder="Billing address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">GST / Tax ID</label>
                <input value={snap.billToTaxId} onChange={(e) => setSnapField("billToTaxId", e.target.value)} className="field-input" placeholder="GSTIN / VAT" />
              </div>
              <div>
                <label className="field-label">Payment terms</label>
                <input value={snap.paymentTerms} onChange={(e) => setSnapField("paymentTerms", e.target.value)} className="field-input" placeholder="e.g. Advance, Net 30" />
              </div>
            </div>
            <div>
              <label className="field-label">Discount % <span className="text-gray-400">(applied on the invoice, before GST)</span></label>
              <input value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} type="number" step="0.01" min="0" max="100" inputMode="decimal" className="field-input" placeholder="From the customer's standing discount" />
            </div>
            <div>
              <label className="field-label">Consignee / ship-to name <span className="text-gray-400">(if different)</span></label>
              <input value={snap.shipToName} onChange={(e) => setSnapField("shipToName", e.target.value)} className="field-input" placeholder="Leave blank if same as bill-to" />
            </div>
            <div>
              <label className="field-label">Ship-to address</label>
              <textarea value={snap.shipToAddress} onChange={(e) => setSnapField("shipToAddress", e.target.value)} rows={2} className="field-input" placeholder="Delivery / consignee address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Destination port</label>
                <input value={snap.destinationPort} onChange={(e) => setSnapField("destinationPort", e.target.value)} className="field-input" placeholder="e.g. New York" />
              </div>
              <div>
                <label className="field-label">Incoterms</label>
                <select value={snap.incoterms} onChange={(e) => setSnapField("incoterms", e.target.value)} className="field-input">
                  {INCOTERMS.map((t) => <option key={t} value={t}>{t || "—"}</option>)}
                </select>
              </div>
            </div>
          </div>
        </details>
      )}

      {/* Product lines */}
      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Products</h2>
        <div className="space-y-3">
          {lines.map((l, idx) => {
            const metres = lineMetres(l);
            const rate = parseFloat(l.rate) || 0;
            const lineTotal = metres * rate;
            const pcs = parseInt(l.pieces, 10);
            const saved = savedPriceFor(l.productId, customerId);
            const rateNum = l.rate === "" ? null : rate;
            const differsFromSaved = saved != null && rateNum != null && Math.abs(saved - rateNum) > 1e-9;
            const justSaved = savedKeys.has(l.key) && !differsFromSaved;
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
                  <ProductPicker options={products} value={l.productId} onChange={(pid) => onProductChange(l.key, pid)} />
                </div>
                <div>
                  <label className="field-label">Description</label>
                  <input value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} className="field-input" placeholder="e.g. colour / spec (optional)" />
                </div>

                {/* Pieces × qty-per-piece = total metres */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="field-label">Pieces</label>
                    <input value={l.pieces} onChange={(e) => updateLine(l.key, { pieces: e.target.value })} className="field-input" type="number" inputMode="numeric" step="1" min="0" placeholder="e.g. 10" />
                  </div>
                  <div>
                    <label className="field-label">Qty / piece</label>
                    <input value={l.perPieceQty} onChange={(e) => updateLine(l.key, { perPieceQty: e.target.value })} className="field-input" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" />
                  </div>
                  <div>
                    <label className="field-label">Unit</label>
                    <select value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} className="field-input">
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <p className="px-1 text-xs text-gray-500">
                  Total: <span className="font-semibold text-gray-700">{metres || 0} {l.unit}</span>
                  {pcs > 0 && <span className="text-gray-400"> ({pcs} × {parseFloat(l.perPieceQty) || 0})</span>}
                </p>

                <div>
                  <label className="field-label">Due date <span className="text-gray-400">(optional — defaults to the order&apos;s)</span></label>
                  <input value={l.dueDate} onChange={(e) => updateLine(l.key, { dueDate: e.target.value })} className="field-input" type="date" />
                </div>

                {/* Rate + regular-price context */}
                <div>
                  <label className="field-label">Rate / {l.unit}</label>
                  <input value={l.rate} onChange={(e) => updateLine(l.key, { rate: e.target.value })} className="field-input" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" />
                  {l.productId && customerId && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs">
                      {saved == null ? (
                        <>
                          {rateNum != null && !justSaved && (
                            <button type="button" onClick={() => saveRegularPrice(l)} disabled={savingKey === l.key} className="font-medium text-brand-600">
                              {savingKey === l.key ? "Saving…" : "Save as this customer's regular price"}
                            </button>
                          )}
                          {justSaved && <span className="text-green-600">✓ Saved as regular price</span>}
                        </>
                      ) : differsFromSaved ? (
                        <>
                          <span className="text-amber-600">One-off — regular is {formatMoney(saved, currency)}</span>
                          <button type="button" onClick={() => saveRegularPrice(l)} disabled={savingKey === l.key} className="font-medium text-brand-600">
                            {savingKey === l.key ? "Saving…" : "Update regular price"}
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400">✓ Regular price</span>
                      )}
                    </div>
                  )}
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
