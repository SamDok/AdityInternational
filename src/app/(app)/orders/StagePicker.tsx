"use client";

import { useState, useTransition } from "react";
import { ORDER_STAGES, STAGE_LABELS, STAGE_COLORS, type OrderStage } from "@/lib/format";
import { updateOrderStage } from "./actions";
import { useToast } from "@/components/Toast";

export default function StagePicker({
  orderId,
  current,
  fulfillment,
  openJobs = 0,
}: {
  orderId: string;
  current: string;
  fulfillment?: { label: string; className: string };
  openJobs?: number;
}) {
  const [stage, setStage] = useState(current);
  const [isPending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const toast = useToast();

  function apply(next: string, opts?: { cancelJobs?: boolean }) {
    const prev = stage;
    setStage(next); // optimistic
    startTransition(async () => {
      const res = await updateOrderStage(orderId, next, opts);
      if (res?.error) { setStage(prev); toast(res.error, { kind: "error" }); }
      else toast(next === "CANCELLED" && opts?.cancelJobs ? "Order and its jobs cancelled" : `Order marked ${STAGE_LABELS[next as OrderStage] ?? next}`);
    });
  }

  function change(next: string) {
    if (next === stage) return;
    // Cancelling with live jobs? Ask whether to stop them too.
    if (next === "CANCELLED" && openJobs > 0) { setConfirmCancel(true); return; }
    apply(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-sm font-semibold text-gray-500">Stage {isPending && "…"}</p>
        {fulfillment && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${fulfillment.className}`}>{fulfillment.label}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {ORDER_STAGES.map((s) => {
          const active = s === stage;
          return (
            <button
              key={s}
              type="button"
              onClick={() => change(s)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active ? STAGE_COLORS[s as OrderStage] + " ring-2 ring-offset-1 ring-current" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {STAGE_LABELS[s]}
            </button>
          );
        })}
      </div>

      {confirmCancel && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 ring-1 ring-inset ring-red-100">
          <p className="text-sm font-medium text-red-800">
            This order has {openJobs} open job{openJobs > 1 ? "s" : ""} with kaarigars / suppliers. Cancel those too so they stop making it?
          </p>
          <p className="mt-0.5 text-xs text-red-600">Fabric already received stays in your stock either way.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={isPending} onClick={() => { setConfirmCancel(false); apply("CANCELLED", { cancelJobs: true }); }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white">
              Cancel order + {openJobs} job{openJobs > 1 ? "s" : ""}
            </button>
            <button type="button" disabled={isPending} onClick={() => { setConfirmCancel(false); apply("CANCELLED"); }}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300">
              Cancel order only
            </button>
            <button type="button" onClick={() => setConfirmCancel(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500">
              Keep order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
