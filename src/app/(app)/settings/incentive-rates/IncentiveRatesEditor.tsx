"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { saveIncentiveRates, seedIncentiveRates } from "./actions";

type Row = { id: string; hsnCode: string; drawbackPct: string; drawbackCap: string; rodtepPct: string; verified: boolean; notes: string };

export default function IncentiveRatesEditor({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(initial);
  const [isPending, startTransition] = useTransition();

  const set = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  function save() {
    startTransition(async () => {
      const res = await saveIncentiveRates(rows.map((r) => ({
        id: r.id, drawbackPct: num(r.drawbackPct), drawbackCap: num(r.drawbackCap),
        rodtepPct: num(r.rodtepPct), verified: r.verified, notes: r.notes || null,
      })));
      if ("error" in res) return toast(res.error, { kind: "error" });
      toast("Rates saved");
      router.refresh();
    });
  }

  function seed() {
    startTransition(async () => {
      const res = await seedIncentiveRates();
      if ("error" in res) return toast(res.error, { kind: "error" });
      toast(res.added > 0 ? `Added ${res.added} HSN${res.added === 1 ? "" : "s"} from the catalogue` : "No new HSNs to add");
      router.refresh();
    });
  }

  const inp = "w-full rounded-lg border-0 bg-gray-50 px-2 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
        These are placeholder rates. <b>Verify each HSN against the current CBIC drawback and DGFT RoDTEP schedule</b> and tick “Verified” once confirmed — unverified rates are flagged wherever incentives are estimated.
      </div>

      <button type="button" onClick={seed} disabled={isPending} className="btn-secondary w-full">
        Add HSNs from the catalogue
      </button>

      {rows.length === 0 ? (
        <p className="card text-sm text-gray-500">No HSN rates yet. Tap “Add HSNs from the catalogue” to seed them from your designs.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-100">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <th className="p-2">HSN</th>
                <th className="p-2">Drawback %</th>
                <th className="p-2">Cap ₹/unit</th>
                <th className="p-2">RoDTEP %</th>
                <th className="p-2 text-center">Verified</th>
                <th className="p-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className={r.verified ? "" : "bg-amber-50/40"}>
                  <td className="p-2 font-semibold text-gray-900">{r.hsnCode}</td>
                  <td className="p-2"><input value={r.drawbackPct} onChange={(e) => set(r.id, { drawbackPct: e.target.value })} type="number" step="0.01" min="0" className={inp} /></td>
                  <td className="p-2"><input value={r.drawbackCap} onChange={(e) => set(r.id, { drawbackCap: e.target.value })} type="number" step="0.01" min="0" placeholder="—" className={inp} /></td>
                  <td className="p-2"><input value={r.rodtepPct} onChange={(e) => set(r.id, { rodtepPct: e.target.value })} type="number" step="0.01" min="0" className={inp} /></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={r.verified} onChange={(e) => set(r.id, { verified: e.target.checked })} className="h-5 w-5" /></td>
                  <td className="p-2"><input value={r.notes} onChange={(e) => set(r.id, { notes: e.target.value })} placeholder="e.g. notification ref" className={inp} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <button type="button" onClick={save} disabled={isPending} className="btn-primary w-full">
          {isPending ? "Saving…" : "Save rates"}
        </button>
      )}
    </div>
  );
}
