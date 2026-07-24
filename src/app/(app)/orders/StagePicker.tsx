"use client";

import { useState, useTransition } from "react";
import { ORDER_STAGES, STAGE_LABELS, STAGE_COLORS, type OrderStage } from "@/lib/format";
import { updateOrderStage } from "./actions";
import { useToast } from "@/components/Toast";

export default function StagePicker({
  orderId,
  current,
  fulfillment,
}: {
  orderId: string;
  current: string;
  fulfillment?: { label: string; className: string };
}) {
  const [stage, setStage] = useState(current);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function change(next: string) {
    if (next === stage) return;
    const prev = stage;
    setStage(next); // optimistic
    startTransition(async () => {
      const res = await updateOrderStage(orderId, next);
      if (res?.error) { setStage(prev); toast(res.error, { kind: "error" }); } // revert on failure
      else toast(`Order marked ${STAGE_LABELS[next as OrderStage] ?? next}`);
    });
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
    </div>
  );
}
