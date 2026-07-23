"use client";

import { useState, useTransition } from "react";
import { ORDER_STATUSES, STATUS_LABELS, STATUS_COLORS, type OrderStatus } from "@/lib/format";
import { updateOrderStatus } from "./actions";

export default function StatusPicker({ orderId, current }: { orderId: string; current: string }) {
  const [status, setStatus] = useState(current);
  const [isPending, startTransition] = useTransition();

  function change(next: string) {
    if (next === status) return;
    const prev = status;
    setStatus(next); // optimistic
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, next);
      if (res?.error) setStatus(prev); // revert on failure
    });
  }

  return (
    <div>
      <p className="mb-2 px-1 text-sm font-semibold text-gray-500">Status {isPending && "…"}</p>
      <div className="flex flex-wrap gap-2">
        {ORDER_STATUSES.map((s) => {
          const active = s === status;
          return (
            <button
              key={s}
              type="button"
              onClick={() => change(s)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active ? STATUS_COLORS[s as OrderStatus] + " ring-2 ring-offset-1 ring-current" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-xs text-gray-400">
        Marking an order <span className="font-medium">Shipped</span> takes its quantities out of stock;
        moving it back adds them in again.
      </p>
    </div>
  );
}
