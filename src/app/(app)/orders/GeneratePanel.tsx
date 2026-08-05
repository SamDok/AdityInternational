"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { formatQty, formatDate } from "@/lib/format";
import { generateProcurement, assignDesignVendor, type GenJob } from "./actions";

type Line = { productId: string; name: string; description: string | null; shortfall: number; needed: number; available: number; unit: string; rate: number | null };
type Group = { vendorId: string; vendorName: string; kind: "JOB_WORK" | "PURCHASE"; jobDueDate: string | Date | null; lines: Line[] };
type VendorOpt = { id: string; name: string; kind: string };

export default function GeneratePanel({
  orderId,
  groups,
  unassigned,
  vendors,
  existingCount,
}: {
  orderId: string;
  groups: Group[];
  unassigned: Line[];
  vendors: VendorOpt[];
  existingCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // Per-group chosen vendor + per-line rate overrides, keyed by the original group.
  const key = (g: Group) => `${g.vendorId}|${g.kind}`;
  const [vendorFor, setVendorFor] = useState<Record<string, string>>(() => Object.fromEntries(groups.map((g) => [key(g), g.vendorId])));
  const [rateFor, setRateFor] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const g of groups) for (const l of g.lines) m[`${key(g)}:${l.productId}`] = l.rate != null ? String(l.rate) : "";
    return m;
  });

  const changed = useMemo(() => groups.some((g) => vendorFor[key(g)] !== g.vendorId), [groups, vendorFor]);

  function generate() {
    const jobs: GenJob[] = groups.map((g) => ({
      kind: g.kind,
      vendorId: vendorFor[key(g)] || g.vendorId,
      lines: g.lines.map((l) => {
        const r = rateFor[`${key(g)}:${l.productId}`];
        return { productId: l.productId, rate: r === "" || r == null ? null : Number(r) };
      }),
    }));
    startTransition(async () => {
      const res = await generateProcurement(orderId, jobs);
      if (res?.error) return toast(res.error, { kind: "error" });
      toast(`Created ${res?.count ?? 0} job${res?.count === 1 ? "" : "s"}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {groups.length > 0 && (
        <>
          <p className="text-xs text-gray-500">{existingCount > 0 ? "Still to make / buy — pick the maker and rate, then generate:" : "Pick the maker and rate for each, then generate:"}</p>
          {groups.map((g) => {
            const k = key(g);
            const compatible = vendors.filter((v) => (g.kind === "PURCHASE" ? v.kind !== "KAARIGAR" : v.kind !== "SUPPLIER"));
            const opts = compatible.length ? compatible : vendors;
            return (
              <div key={k} className="rounded-xl bg-gray-50 p-3 ring-1 ring-inset ring-gray-100">
                <div className="mb-2 flex items-center gap-2">
                  <select
                    value={vendorFor[k]} onChange={(e) => setVendorFor((s) => ({ ...s, [k]: e.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border-0 bg-white px-2 py-1.5 text-sm font-medium ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none">
                    {opts.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <span className="shrink-0 text-xs text-gray-400">{g.kind === "JOB_WORK" ? "Job work" : "Purchase"}{g.jobDueDate ? ` · due ${formatDate(g.jobDueDate)}` : ""}</span>
                </div>
                <ul className="space-y-1.5">
                  {g.lines.map((l) => (
                    <li key={l.productId} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                        {l.name}{l.description ? ` · ${l.description}` : ""} — <span className="font-medium text-gray-900">{formatQty(l.shortfall)} {l.unit}</span>
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[11px] text-gray-400">rate</span>
                        <input
                          value={rateFor[`${k}:${l.productId}`] ?? ""} onChange={(e) => setRateFor((s) => ({ ...s, [`${k}:${l.productId}`]: e.target.value }))}
                          type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                          className="w-20 rounded-lg border-0 bg-white px-2 py-1 text-right text-xs ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <button type="button" onClick={generate} disabled={isPending} className="btn-primary w-full">
            {isPending ? "Generating…" : existingCount > 0 ? "Generate remaining jobs" : changed ? "Generate with chosen makers" : "Generate jobs & purchase orders"}
          </button>
        </>
      )}

      {unassigned.length > 0 && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-inset ring-amber-100">
          <p className="text-xs font-medium text-amber-800">These lines need a kaarigar / supplier before a job can be made:</p>
          {unassigned.map((l) => (
            <AssignRow key={l.productId} line={l} vendors={vendors} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignRow({ line, vendors }: { line: Line; vendors: VendorOpt[] }) {
  const router = useRouter();
  const toast = useToast();
  const [vendorId, setVendorId] = useState("");
  const [isPending, startTransition] = useTransition();

  function assign() {
    if (!vendorId) return toast("Choose a vendor", { kind: "error" });
    startTransition(async () => {
      const res = await assignDesignVendor(line.productId, vendorId);
      if (res?.error) return toast(res.error, { kind: "error" });
      toast("Vendor assigned");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-xs text-gray-800">{line.name}{line.description ? ` · ${line.description}` : ""}</span>
      <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="shrink-0 rounded-lg border-0 bg-white px-2 py-1 text-xs ring-1 ring-inset ring-gray-200 focus:outline-none">
        <option value="">Assign…</option>
        {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <button type="button" onClick={assign} disabled={isPending} className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">{isPending ? "…" : "Set"}</button>
    </div>
  );
}
