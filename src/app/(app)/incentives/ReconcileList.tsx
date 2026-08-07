"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { formatMoney, formatDate } from "@/lib/format";
import { reconcileCredit, unlinkCredit, deleteBankCredit } from "./actions";

export type CreditRow = { id: string; date: string; amount: number; narration: string | null; reference: string | null; suggestedClaimId: string | null; confidence: string | null };
export type ClaimOpt = { id: string; label: string };
export type ReconciledRow = { id: string; date: string; amount: number; narration: string | null; claimLabel: string };

const CONF: Record<string, string> = { high: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", low: "bg-gray-100 text-gray-600" };

export default function ReconcileList({ credits, claims, reconciled }: { credits: CreditRow[]; claims: ClaimOpt[]; reconciled: ReconciledRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [pick, setPick] = useState<Record<string, string>>(() => Object.fromEntries(credits.map((c) => [c.id, c.suggestedClaimId ?? ""])));

  const run = (fn: () => Promise<unknown>, msg?: string) => startTransition(async () => { await fn(); if (msg) toast(msg); router.refresh(); });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Unreconciled credits ({credits.length})</h2>
        {credits.length === 0 ? (
          <p className="card text-sm text-gray-500">No unmatched credits. Import a statement to reconcile incentive money.</p>
        ) : (
          <ul className="space-y-2">
            {credits.map((c) => (
              <li key={c.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{formatMoney(c.amount, "INR")}<span className="ml-2 text-xs font-normal text-gray-400">{formatDate(c.date)}</span></p>
                    {c.narration && <p className="truncate text-xs text-gray-500">{c.narration}</p>}
                  </div>
                  {c.confidence && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CONF[c.confidence] ?? "bg-gray-100 text-gray-600"}`}>{c.confidence} match</span>}
                </div>
                {claims.length > 0 ? (
                  <div className="flex gap-2">
                    <select value={pick[c.id] ?? ""} onChange={(e) => setPick((p) => ({ ...p, [c.id]: e.target.value }))} className="min-w-0 flex-1 rounded-lg border-0 bg-gray-50 px-2 py-1.5 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none">
                      <option value="">Choose a claim…</option>
                      {claims.map((cl) => <option key={cl.id} value={cl.id}>{cl.label}</option>)}
                    </select>
                    <button type="button" disabled={isPending || !pick[c.id]} onClick={() => run(() => reconcileCredit(c.id, pick[c.id]), "Reconciled")} className="btn-primary shrink-0 !px-3 !py-1.5 text-sm">Reconcile</button>
                    <button type="button" disabled={isPending} onClick={() => run(() => deleteBankCredit(c.id))} className="shrink-0 px-2 text-gray-400 hover:text-red-600" aria-label="Delete credit">✕</button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No open claims to match. Generate claims first.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {reconciled.length > 0 && (
        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Reconciled ({reconciled.length})</h2>
          <ul className="divide-y divide-gray-100 rounded-2xl bg-white ring-1 ring-gray-100">
            {reconciled.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{formatMoney(c.amount, "INR")} <span className="text-xs font-normal text-gray-400">{formatDate(c.date)}</span></p>
                  <p className="truncate text-xs text-gray-500">→ {c.claimLabel}</p>
                </div>
                <button type="button" disabled={isPending} onClick={() => run(() => unlinkCredit(c.id), "Unlinked")} className="shrink-0 text-xs font-medium text-brand-600">Unlink</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
