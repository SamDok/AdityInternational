"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import type { RouteStepInput } from "./routeActions";

type Vendor = { id: string; name: string };
type Row = { name: string; vendorId: string; unit: string; ratioFromPrev: string; rate: string };

const UNITS = ["mtr", "kg", "pcs", "sq mtr", "gm", "yd"];

export default function RouteEditor({
  title,
  hint,
  vendors,
  initial,
  action,
}: {
  title: string;
  hint: string;
  vendors: Vendor[];
  initial: { name: string; vendorId: string | null; unit: string; ratioFromPrev: number | null; rate: number | null }[];
  action: (steps: RouteStepInput[]) => Promise<{ error?: string; ok?: boolean } | void>;
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.map((s) => ({
      name: s.name,
      vendorId: s.vendorId ?? "",
      unit: s.unit,
      ratioFromPrev: s.ratioFromPrev != null ? String(s.ratioFromPrev) : "",
      rate: s.rate != null ? String(s.rate) : "",
    })),
  );
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function setRow(i: number, patch: Partial<Row>) { setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); }
  function addRow() { setRows((rs) => [...rs, { name: "", vendorId: "", unit: rs.length === 0 ? "mtr" : "mtr", ratioFromPrev: "", rate: "" }]); }
  function removeRow(i: number) { setRows((rs) => rs.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function save() {
    const steps: RouteStepInput[] = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        vendorId: r.vendorId || null,
        unit: r.unit || "mtr",
        ratioFromPrev: r.ratioFromPrev === "" ? null : Number(r.ratioFromPrev),
        rate: r.rate === "" ? null : Number(r.rate),
      }));
    startTransition(async () => {
      const res = await action(steps);
      if (res?.error) { toast(res.error, { kind: "error" }); return; }
      toast("Production route saved");
    });
  }

  return (
    <div className="card space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>

      {rows.length === 0 && <p className="text-sm text-gray-400">No route set — designs of this type get a single job to their assigned kaarigar (the normal case).</p>}

      {rows.map((r, i) => {
        const prevUnit = i > 0 ? rows[i - 1].unit : null;
        return (
          <div key={i} className="rounded-lg border border-gray-200 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">Step {i + 1}{i === rows.length - 1 && rows.length > 1 ? " · final → stock" : ""}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move down">↓</button>
                <button type="button" onClick={() => removeRow(i)} className="px-1.5 text-gray-400 hover:text-red-600" aria-label="Remove">✕</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} className="field-input !h-9 !py-1 text-sm" placeholder="Step name (e.g. Dyeing)" />
              <select value={r.vendorId} onChange={(e) => setRow(i, { vendorId: e.target.value })} className="field-input !h-9 !py-1 text-sm">
                <option value="">Kaarigar (optional)…</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-1.5">
              <div>
                <label className="block text-[11px] text-gray-400">Unit</label>
                <select value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} className="field-input !h-9 !py-1 text-sm">
                  {[...new Set([r.unit, ...UNITS])].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-400">{i === 0 ? "—" : `${r.unit} per 1 ${prevUnit}`}</label>
                <input value={r.ratioFromPrev} onChange={(e) => setRow(i, { ratioFromPrev: e.target.value })} type="number" step="any" min="0" inputMode="decimal" disabled={i === 0} className="field-input !h-9 !py-1 text-sm disabled:bg-gray-100" placeholder={i === 0 ? "" : "e.g. 3"} />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400">Rate / {r.unit} (opt)</label>
                <input value={r.rate} onChange={(e) => setRow(i, { rate: e.target.value })} type="number" step="any" min="0" inputMode="decimal" className="field-input !h-9 !py-1 text-sm" placeholder="charge" />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex gap-2">
        <button type="button" onClick={addRow} className="btn-secondary flex-1 !py-2 text-sm">+ Add step</button>
        <button type="button" disabled={isPending} onClick={save} className="btn-primary flex-1 !py-2 text-sm">{isPending ? "Saving…" : "Save route"}</button>
      </div>
    </div>
  );
}
