"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { formatMoney, formatDate } from "@/lib/format";
import { generateShipmentClaims, createItcClaim, fileClaim, receiveClaim, reopenClaim, deleteClaim } from "./actions";

export type ClaimRow = {
  id: string; type: string; title: string; sub: string;
  amount: number; status: string; reference: string | null;
  filedDate: string | null; receivedDate: string | null; receivedAmount: number | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-gray-100 text-gray-600" },
  FILED: { label: "Filed", cls: "bg-amber-100 text-amber-700" },
  RECEIVED: { label: "Received", cls: "bg-green-100 text-green-700" },
};
const today = () => new Date().toISOString().slice(0, 10);

export default function ClaimsPanel({ claims }: { claims: ClaimRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [amt, setAmt] = useState("");
  const [date, setDate] = useState(today());

  const run = (fn: () => Promise<unknown>, msg?: string) =>
    startTransition(async () => { await fn(); setOpenId(null); if (msg) toast(msg); router.refresh(); });

  function openFor(c: ClaimRow) {
    setOpenId(c.id);
    setRef(c.reference ?? "");
    setAmt(String(c.amount));
    setDate(today());
  }

  const inp = "w-full rounded-lg border-0 bg-gray-50 px-2 py-1.5 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" disabled={isPending} onClick={() => run(generateShipmentClaims, "Claims generated")} className="btn-secondary flex-1 text-sm">Generate export claims</button>
        <button type="button" disabled={isPending} onClick={() => run(createItcClaim, "ITC claim created")} className="btn-secondary flex-1 text-sm">New ITC claim</button>
      </div>

      {claims.length === 0 ? (
        <p className="card text-sm text-gray-500">No claims yet. “Generate export claims” creates Drawback/RoDTEP claims from your export shipments.</p>
      ) : (
        <ul className="space-y-2">
          {claims.map((c) => {
            const st = STATUS[c.status] ?? { label: c.status, cls: "bg-gray-100 text-gray-600" };
            return (
              <li key={c.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-500">{c.sub}{c.reference ? ` · ${c.reference}` : ""}</p>
                    {c.status === "RECEIVED" && (
                      <p className="mt-0.5 text-xs text-green-700">Received {formatMoney(c.receivedAmount ?? c.amount, "INR")}{c.receivedDate ? ` · ${formatDate(c.receivedDate)}` : ""}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatMoney(c.amount, "INR")}</p>
                  </div>
                </div>

                {openId === c.id ? (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {c.status === "PENDING" && (
                      <>
                        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Shipping bill / ARN / scrip no." className={inp} />
                        <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={inp} />
                        <button type="button" disabled={isPending} onClick={() => run(() => fileClaim(c.id, { reference: ref || null, filedDate: date }), "Marked filed")} className="btn-primary w-full text-sm">Mark filed</button>
                      </>
                    )}
                    {c.status === "FILED" && (
                      <>
                        <label className="block text-xs text-gray-500">Amount received (INR)
                          <input value={amt} onChange={(e) => setAmt(e.target.value)} type="number" step="0.01" min="0" className={inp} /></label>
                        <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={inp} />
                        <button type="button" disabled={isPending} onClick={() => run(() => receiveClaim(c.id, { receivedAmount: amt === "" ? null : Number(amt), receivedDate: date }), "Marked received")} className="btn-primary w-full text-sm">Mark received</button>
                      </>
                    )}
                    {c.status === "RECEIVED" && (
                      <button type="button" disabled={isPending} onClick={() => run(() => reopenClaim(c.id), "Reopened")} className="btn-secondary w-full text-sm">Reopen</button>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setOpenId(null)} className="btn-secondary flex-1 text-sm">Close</button>
                      <button type="button" disabled={isPending} onClick={() => run(() => deleteClaim(c.id), "Claim deleted")} className="flex-1 rounded-xl px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-inset ring-red-200 active:bg-red-50">Delete</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => openFor(c)} className="mt-2 text-xs font-medium text-brand-600">Update →</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
