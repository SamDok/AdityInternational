"use client";

import { useTransition } from "react";
import { unshipLine } from "./actions";

// Small correction control: undo a line's shipment (restores stock).
export default function UnshipButton({ itemId }: { itemId: string }) {
  const [isPending, startTransition] = useTransition();
  function onClick() {
    if (!confirm("Undo this line's shipment and add the stock back?")) return;
    startTransition(async () => {
      await unshipLine(itemId);
    });
  }
  return (
    <button type="button" onClick={onClick} disabled={isPending} className="text-xs font-medium text-amber-600 hover:text-amber-700">
      {isPending ? "…" : "Undo shipment"}
    </button>
  );
}
