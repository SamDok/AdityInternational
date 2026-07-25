"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, formatMoney } from "@/lib/format";
import { useToast } from "@/components/Toast";
import type { ShipmentInput } from "./actions";
import type { ReadyLine } from "./ready";

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

type Row = { include: boolean; qty: string; pieces: string; netWeight: string };

const todayStr = () => new Date().toISOString().slice(0, 10);
const INCOTERMS = ["", "EXW", "FOB", "CFR", "CIF", "DAP", "DDP"];

export default function ShipmentBuilder({
  customerId,
  customerName,
  currency: initialCurrency,
  snapshot,
  lines,
  preselectOrderId,
  action,
}: {
  customerId: string;
  customerName: string;
  currency: string;
  snapshot: Snapshot;
  lines: ReadyLine[];
  preselectOrderId?: string;
  action: (input: ShipmentInput) => Promise<{ error?: string } | void>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [currency, setCurrency] = useState(initialCurrency);
  const [date, setDate] = useState(todayStr());
  const [marks, setMarks] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [snap, setSnap] = useState<Snapshot>(snapshot);
  const setSnapField = (k: keyof Snapshot, v: string) => setSnap((p) => ({ ...p, [k]: v }));

  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.orderItemId,
        {
          include: !preselectOrderId || l.orderId === preselectOrderId,
          qty: String(l.ready || ""),
          pieces: "",
          netWeight: "",
        },
      ]),
    ),
  );
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  // Group ready lines by order for display.
  const groups = useMemo(() => {
    const m = new Map<number, ReadyLine[]>();
    for (const l of lines) {
      if (!m.has(l.orderNumber)) m.set(l.orderNumber, []);
      m.get(l.orderNumber)!.push(l);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [lines]);

  const totals = useMemo(() => {
    let value = 0, pieces = 0, metres = 0, netWeight = 0, count = 0;
    for (const l of lines) {
      const r = rows[l.orderItemId];
      if (!r?.include) continue;
      const q = parseFloat(r.qty) || 0;
      if (q <= 0) continue;
      count++;
      value += q * l.rate;
      metres += q;
      pieces += parseInt(r.pieces, 10) || 0;
      netWeight += parseFloat(r.netWeight) || 0;
    }
    return { value, pieces, metres, netWeight, count };
  }, [lines, rows]);

  function submit() {
    setError(null);
    const chosen = lines
      .filter((l) => rows[l.orderItemId]?.include && (parseFloat(rows[l.orderItemId].qty) || 0) > 0)
      .map((l) => {
        const r = rows[l.orderItemId];
        return {
          orderItemId: l.orderItemId,
          qty: Number(r.qty),
          pieces: r.pieces === "" ? null : Number(r.pieces),
          netWeight: r.netWeight === "" ? null : Number(r.netWeight),
        };
      });
    if (chosen.length === 0) return setError("Select at least one line with a quantity to ship.");
    const input: ShipmentInput = {
      customerId,
      currency,
      date,
      billToName: snap.billToName || null,
      billToAddress: snap.billToAddress || null,
      billToTaxId: snap.billToTaxId || null,
      shipToName: snap.shipToName || null,
      shipToAddress: snap.shipToAddress || null,
      destinationPort: snap.destinationPort || null,
      incoterms: snap.incoterms || null,
      paymentTerms: snap.paymentTerms || null,
      marksNumbers: marks || null,
      grossWeight: grossWeight === "" ? null : Number(grossWeight),
      notes: notes || null,
      lines: chosen,
    };
    startTransition(async () => {
      const res = await action(input);
      if (res?.error) { setError(res.error); toast(res.error, { kind: "error" }); }
      else toast("Shipment created");
    });
  }

  if (lines.length === 0) {
    return (
      <div className="p-4">
        <div className="card space-y-2 text-center">
          <p className="text-gray-700">Nothing ready to ship for {customerName}.</p>
          <p className="text-sm text-gray-500">Receive stock from jobs first, then come back.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="card space-y-3">
        <p className="text-sm text-gray-500">Shipping to</p>
        <p className="-mt-2 font-semibold text-gray-900">{customerName}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="date">Ship date</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input" />
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
        <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">What&apos;s going out</h2>
        <div className="space-y-4">
          {groups.map(([orderNumber, glines]) => (
            <div key={orderNumber}>
              <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Order #{orderNumber}</p>
              <div className="space-y-2">
                {glines.map((l) => {
                  const r = rows[l.orderItemId];
                  const q = parseFloat(r.qty) || 0;
                  const pcsHint = l.perPieceQty && l.perPieceQty > 0 && q > 0 ? Math.round((q / l.perPieceQty) * 100) / 100 : null;
                  return (
                    <div key={l.orderItemId} className={`rounded-xl p-3 ring-1 ring-inset ${r.include ? "bg-white ring-gray-200" : "bg-gray-50 ring-gray-100"}`}>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" checked={r.include} onChange={(e) => setRow(l.orderItemId, { include: e.target.checked })} className="mt-1 h-4 w-4 shrink-0 rounded" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{l.productName}</p>
                          <p className="text-xs text-gray-500">{l.shipped}/{l.ordered} {l.unit} shipped · {l.remaining} left · {l.stock} in stock</p>
                        </div>
                      </label>
                      {r.include && (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-gray-500">Ship ({l.unit}){pcsHint != null ? ` · ≈${pcsHint} pcs` : ""}</span>
                            <input value={r.qty} onChange={(e) => setRow(l.orderItemId, { qty: e.target.value })} type="number" inputMode="decimal" step="0.01" min="0" className="field-input !py-2" />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-gray-500">Pieces</span>
                            <input value={r.pieces} onChange={(e) => setRow(l.orderItemId, { pieces: e.target.value })} type="number" inputMode="numeric" step="1" min="0" className="field-input !py-2" placeholder="—" />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-gray-500">Net wt (kg)</span>
                            <input value={r.netWeight} onChange={(e) => setRow(l.orderItemId, { netWeight: e.target.value })} type="number" inputMode="decimal" step="0.01" min="0" className="field-input !py-2" placeholder="—" />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="gross">Gross weight (kg)</label>
            <input id="gross" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} type="number" inputMode="decimal" step="0.01" min="0" className="field-input" placeholder="Total incl. packing" />
          </div>
          <div>
            <label className="field-label" htmlFor="marks">Marks &amp; numbers</label>
            <input id="marks" value={marks} onChange={(e) => setMarks(e.target.value)} className="field-input" placeholder="Shipping marks" />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="notes">Notes</label>
          <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="field-input" placeholder="For the documents" />
        </div>
      </div>

      <details className="card">
        <summary className="cursor-pointer list-none font-semibold text-gray-900">
          Bill-to / ship-to on the documents <span className="ml-1 text-xs font-normal text-gray-400">— prefilled, tap to edit</span>
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className="field-label">Bill to (name)</label>
            <input value={snap.billToName} onChange={(e) => setSnapField("billToName", e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">Bill-to address</label>
            <textarea value={snap.billToAddress} onChange={(e) => setSnapField("billToAddress", e.target.value)} rows={2} className="field-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">GST / Tax ID</label>
              <input value={snap.billToTaxId} onChange={(e) => setSnapField("billToTaxId", e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label">Payment terms</label>
              <input value={snap.paymentTerms} onChange={(e) => setSnapField("paymentTerms", e.target.value)} className="field-input" />
            </div>
          </div>
          <div>
            <label className="field-label">Consignee / ship-to name <span className="text-gray-400">(if different)</span></label>
            <input value={snap.shipToName} onChange={(e) => setSnapField("shipToName", e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">Ship-to address</label>
            <textarea value={snap.shipToAddress} onChange={(e) => setSnapField("shipToAddress", e.target.value)} rows={2} className="field-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Destination port</label>
              <input value={snap.destinationPort} onChange={(e) => setSnapField("destinationPort", e.target.value)} className="field-input" />
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

      <div className="card flex items-center justify-between bg-brand-50">
        <span className="text-sm font-semibold text-brand-900">{totals.count} line{totals.count === 1 ? "" : "s"} · {totals.metres} mtr{totals.pieces ? ` · ${totals.pieces} pcs` : ""}</span>
        <span className="text-lg font-bold text-brand-900">{formatMoney(totals.value, currency)}</span>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-primary flex-1">{isPending ? "Saving…" : "Create shipment"}</button>
      </div>
    </div>
  );
}
